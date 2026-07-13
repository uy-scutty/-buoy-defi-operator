import { ethers } from "ethers";
import { RiskOutput } from "./risk.service";
import { buildUnsignedUserOp, UnsignedUserOperation } from "../../wallet/userOperation";
import mockAavePoolAbi from "../../config/abi/MockAavePool.json";
import {
    DEMO_WETH_ADDRESS,
    DEMO_USDC_ADDRESS,
    WETH_LIQUIDATION_THRESHOLD_PCT,
    TARGET_HEALTH_FACTOR,
} from "../../config/assets";

export interface ExecutionOutput {
    recommendedAction: "REPAY" | "SUPPLY";
    targetAmountUSD: number;
    preparedUserOp: UnsignedUserOperation | null; // null if smartAccountAddress not yet known
}

const mockAavePoolInterface = new ethers.Interface(mockAavePoolAbi as any);

/**
 * Execution Agent: decides REPAY vs SUPPLY based on the Risk Agent's output,
 * computes the amount needed to restore Health Factor to TARGET_HEALTH_FACTOR,
 * and builds real calldata targeting MockAavePool — wrapped for execution via
 * the user's SentinelSmartAccount. Returns an UNSIGNED UserOperation only.
 *
 * smartAccountAddress is optional: if the user hasn't deployed their smart
 * account yet, we still compute and return the recommendation and the inner
 * calldata's intent, but preparedUserOp is null (nothing to wrap/sign yet).
 */
export async function runExecutionAgent(
    risk: RiskOutput,
    smartAccountAddress: string | null
): Promise<ExecutionOutput> {
    const { action, amountUSD } = computeRecommendedAction(risk);

    let preparedUserOp: UnsignedUserOperation | null = null;

    if (smartAccountAddress) {
        const innerCallData = buildPoolCallData(action, amountUSD);
        const outerCallData = wrapForSmartAccountExecute(innerCallData);
        preparedUserOp = await buildUnsignedUserOp(smartAccountAddress, outerCallData);
    }

    return {
        recommendedAction: action,
        targetAmountUSD: amountUSD,
        preparedUserOp,
    };
}

function computeRecommendedAction(risk: RiskOutput): { action: "REPAY" | "SUPPLY"; amountUSD: number } {
    const liqThresholdFraction = risk.liquidationThresholdPct / 100;

    if (risk.totalDebtUSD > 0) {
        // REPAY path: find target debt such that HF reaches TARGET_HEALTH_FACTOR,
        // then repay the difference.
        const targetDebtUSD = (risk.totalCollateralUSD * liqThresholdFraction) / TARGET_HEALTH_FACTOR;
        const repayAmountUSD = Math.max(risk.totalDebtUSD - targetDebtUSD, 0);
        return { action: "REPAY", amountUSD: round2(repayAmountUSD) };
    }

    // SUPPLY path: no debt currently, but we still recommend building a
    // buffer — supply enough to noticeably improve the collateral base.
    // Simplified MVP heuristic: recommend 10% of existing collateral as
    // additional buffer (or a fixed small amount if collateral is zero).
    const supplyAmountUSD = risk.totalCollateralUSD > 0 ? risk.totalCollateralUSD * 0.1 : 100;
    return { action: "SUPPLY", amountUSD: round2(supplyAmountUSD) };
}

function buildPoolCallData(action: "REPAY" | "SUPPLY", amountUSD: number): string {
    if (action === "REPAY") {
        // Debt asset is USDC, $1 price, so USD amount maps directly to token amount.
        const amountRaw = ethers.parseUnits(amountUSD.toFixed(6), 18);
        return mockAavePoolInterface.encodeFunctionData("repay", [DEMO_USDC_ADDRESS, amountRaw]);
    }

    // Collateral asset is WETH, $2000 price — convert USD amount to WETH units.
    const wethAmount = amountUSD / 2000;
    const amountRaw = ethers.parseUnits(wethAmount.toFixed(6), 18);
    return mockAavePoolInterface.encodeFunctionData("supply", [DEMO_WETH_ADDRESS, amountRaw]);
}

/** Wraps inner pool calldata into a call to SentinelSmartAccount.execute(target, value, data). */
function wrapForSmartAccountExecute(innerCallData: string): string {
    const smartAccountInterface = new ethers.Interface([
        "function execute(address target, uint256 value, bytes data)",
    ]);
    // Target is always MockAavePool for this MVP — a real deployment would
    // pass the actual pool address here, sourced from env/config.
    const targetPoolAddress = process.env.MOCK_AAVE_POOL_ADDRESS ?? ethers.ZeroAddress;
    return smartAccountInterface.encodeFunctionData("execute", [targetPoolAddress, 0, innerCallData]);
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}