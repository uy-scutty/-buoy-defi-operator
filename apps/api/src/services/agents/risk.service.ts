import { ethers } from "ethers";
import { provider } from "../../config/chain";
import { env } from "../../config/env";
import mockAavePoolAbi from "../../config/abi/MockAavePool.json";
import { discoverPosition, DiscoveredPosition, AssetPosition } from "../positionDiscovery.service";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface RiskOutput {
    collateralAssets: AssetPosition[];
    debtAssets: AssetPosition[];
    totalCollateralUSD: number;
    totalDebtUSD: number;
    ltvPct: number; // weighted average across whatever collateral assets exist
    liquidationThresholdPct: number; // weighted average, from the pool's own calculation
    healthFactor: number | null;
    riskLevel: RiskLevel;
}

const HF_SCALE = 1e18;
const BPS_SCALE = 100;

export async function runRiskAgent(walletAddress: string): Promise<RiskOutput> {
    const position: DiscoveredPosition = await discoverPosition(walletAddress);
    const { healthFactor, ltvPct, liquidationThresholdPct } = await fetchAccountData(walletAddress);

    return {
        collateralAssets: position.collateralAssets,
        debtAssets: position.debtAssets,
        totalCollateralUSD: position.totalCollateralUSD,
        totalDebtUSD: position.totalDebtUSD,
        ltvPct,
        liquidationThresholdPct,
        healthFactor,
        riskLevel: deriveRiskLevel(healthFactor),
    };
}

async function fetchAccountData(walletAddress: string): Promise<{
    healthFactor: number | null;
    ltvPct: number;
    liquidationThresholdPct: number;
}> {
    if (!env.MOCK_AAVE_POOL_ADDRESS) {
        throw new Error("MOCK_AAVE_POOL_ADDRESS is not configured — deploy contracts first");
    }

    const pool = new ethers.Contract(env.MOCK_AAVE_POOL_ADDRESS, mockAavePoolAbi as any, provider);
    const result = await pool.getUserAccountData(walletAddress);

    const rawHealthFactor: bigint = result[5];
    const isMaxUint = rawHealthFactor === ethers.MaxUint256;

    return {
        healthFactor: isMaxUint ? null : Number(rawHealthFactor) / HF_SCALE,
        liquidationThresholdPct: Number(result[3]) / BPS_SCALE,
        ltvPct: Number(result[4]) / BPS_SCALE,
    };
}

function deriveRiskLevel(healthFactor: number | null): RiskLevel {
    if (healthFactor === null) return "LOW";
    if (healthFactor >= 2.0) return "LOW";
    if (healthFactor >= 1.5) return "MEDIUM";
    if (healthFactor >= 1.1) return "HIGH";
    return "CRITICAL";
}