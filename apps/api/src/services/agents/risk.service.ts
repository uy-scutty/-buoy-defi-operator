import { getPosition, PositionData } from "../position.service";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface RiskOutput {
    totalCollateralUSD: number;
    totalDebtUSD: number;
    availableBorrowsUSD: number;
    liquidationThresholdPct: number; // e.g. 85 for 85%
    ltvPct: number;                   // e.g. 80 for 80%
    healthFactor: number | null;      // null represents "infinite" (no debt)
    riskLevel: RiskLevel;
}

const USD_SCALE = 1e18;
const BPS_SCALE = 100; // basis points -> percentage (divide by 100, not 10000, since bps/100 = %)
const HF_SCALE = 1e18;

/**
 * Risk Agent: computes Health Factor, LTV, Liquidation Threshold, Total
 * Collateral, and Total Debt from raw on-chain position data, and derives
 * a plain risk label. No LLM call happens here — this is pure, deterministic
 * math, matching the architecture doc's separation of Risk Agent from the
 * Supervisor's plain-English synthesis step.
 */
export async function runRiskAgent(walletAddress: string): Promise<RiskOutput> {
    const position: PositionData = await getPosition(walletAddress);

    const totalCollateralUSD = Number(position.totalCollateralUSD) / USD_SCALE;
    const totalDebtUSD = Number(position.totalDebtUSD) / USD_SCALE;
    const availableBorrowsUSD = Number(position.availableBorrowsUSD) / USD_SCALE;
    const liquidationThresholdPct = Number(position.currentLiquidationThreshold) / BPS_SCALE;
    const ltvPct = Number(position.ltv) / BPS_SCALE;

    const isMaxUint = position.healthFactor === ethersMaxUint256String();
    const healthFactor = isMaxUint ? null : Number(position.healthFactor) / HF_SCALE;

    return {
        totalCollateralUSD,
        totalDebtUSD,
        availableBorrowsUSD,
        liquidationThresholdPct,
        ltvPct,
        healthFactor,
        riskLevel: deriveRiskLevel(healthFactor),
    };
}

function deriveRiskLevel(healthFactor: number | null): RiskLevel {
    if (healthFactor === null) return "LOW"; // no debt at all
    if (healthFactor >= 2.0) return "LOW";
    if (healthFactor >= 1.5) return "MEDIUM";
    if (healthFactor >= 1.1) return "HIGH";
    return "CRITICAL"; // at or below 1.1 — near or at liquidation
}

/** Returns type(uint256).max as a string, matching MockAavePool's "no debt" convention. */
function ethersMaxUint256String(): string {
    return "115792089237316195423570985008687907853269984665640564039457584007913129639935";
}