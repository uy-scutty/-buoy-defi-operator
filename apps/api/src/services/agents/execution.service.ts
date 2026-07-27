import { ethers } from "ethers";
import { RiskOutput } from "./risk.service";
import { AssetPosition } from "../positionDiscovery.service";
import { buildUnsignedUserOp, UnsignedUserOperation } from "../../wallet/userOperation";
import { env } from "../../config/env";
import mockAavePoolAbi from "../../config/abi/MockAavePool.json";

export type RecommendedAction = "REPAY" | "SUPPLY" | "NONE";

export interface ExecutionOutput {
    recommendedAction: RecommendedAction;
    targetAsset: string | null; // symbol, for display
    targetAmountUSD: number;
    preparedUserOp: UnsignedUserOperation | null;
}

const TARGET_HEALTH_FACTOR = 1.5;
const mockAavePoolInterface = new ethers.Interface(mockAavePoolAbi as any);

/**
 * Execution Agent: chooses which asset to act on based on the user's ACTUAL
 * position — the largest debt to repay, or largest existing collateral to
 * top up — never a fixed hardcoded asset. If the user holds no position at
 * all, returns NONE rather than guessing an asset to recommend, since
 * there's no general price-lookup for assets the user has never touched.
 */
export async function runExecutionAgent(
    risk: RiskOutput,
    smartAccountAddress: string | null
): Promise<ExecutionOutput> {
    const decision = computeRecommendedAction(risk);

    if (decision.action === "NONE" || !decision.asset) {
        return { recommendedAction: "NONE", targetAsset: null, targetAmountUSD: 0, preparedUserOp: null };
    }

    let preparedUserOp: UnsignedUserOperation | null = null;

    if (smartAccountAddress) {
        const innerCallData = buildPoolCallData(decision.action, decision.amountUSD, decision.asset, smartAccountAddress);
        const outerCallData = wrapForSmartAccountExecute(innerCallData);
        preparedUserOp = await buildUnsignedUserOp(smartAccountAddress, outerCallData);
    }

    return {
        recommendedAction: decision.action,
        targetAsset: decision.asset.symbol,
        targetAmountUSD: decision.amountUSD,
        preparedUserOp,
    };
}

function computeRecommendedAction(
    risk: RiskOutput
): { action: "REPAY"; amountUSD: number; asset: AssetPosition }
    | { action: "SUPPLY"; amountUSD: number; asset: AssetPosition }
    | { action: "NONE"; amountUSD: 0; asset: null } {
    if (risk.totalDebtUSD > 0 && risk.debtAssets.length > 0) {
        const largestDebt = [...risk.debtAssets].sort((a, b) => b.debtUSD - a.debtUSD)[0];

        const liqThresholdFraction = risk.liquidationThresholdPct / 100;
        const targetDebtUSD = (risk.totalCollateralUSD * liqThresholdFraction) / TARGET_HEALTH_FACTOR;
        const repayAmountUSD = Math.min(
            Math.max(risk.totalDebtUSD - targetDebtUSD, 0),
            largestDebt.debtUSD
        );

        if (repayAmountUSD === 0) {
            return { action: "NONE", amountUSD: 0, asset: null };
        }

        return { action: "REPAY", amountUSD: round2(repayAmountUSD), asset: largestDebt };
    }
    if (risk.collateralAssets.length > 0) {
        const largestCollateral = [...risk.collateralAssets].sort((a, b) => b.collateralUSD - a.collateralUSD)[0];
        const supplyAmountUSD = largestCollateral.collateralUSD * 0.1;
        return { action: "SUPPLY", amountUSD: round2(supplyAmountUSD), asset: largestCollateral };
    }

    return { action: "NONE", amountUSD: 0, asset: null };
}

function buildPoolCallData(
    action: "REPAY" | "SUPPLY",
    amountUSD: number,
    asset: AssetPosition,
    onBehalfOf: string
): string {
    const rawAmountHeld = action === "REPAY" ? BigInt(asset.debtAmount) : BigInt(asset.collateralAmount);
    const usdValueHeld = action === "REPAY" ? asset.debtUSD : asset.collateralUSD;
    const pricePerToken = usdValueHeld / (Number(rawAmountHeld) / 10 ** asset.decimals);

    const tokenAmount = amountUSD / pricePerToken;
    const amountRaw = ethers.parseUnits(tokenAmount.toFixed(asset.decimals > 6 ? 6 : asset.decimals), asset.decimals);

    return mockAavePoolInterface.encodeFunctionData(action === "REPAY" ? "repay" : "supply", [
        asset.asset,
        amountRaw,
        onBehalfOf,
    ]);
}

function wrapForSmartAccountExecute(innerCallData: string): string {
    const smartAccountInterface = new ethers.Interface([
        "function execute(address target, uint256 value, bytes data)",
    ]);
    const targetPoolAddress = env.MOCK_AAVE_POOL_ADDRESS ?? ethers.ZeroAddress;
    return smartAccountInterface.encodeFunctionData("execute", [targetPoolAddress, 0, innerCallData]);
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}