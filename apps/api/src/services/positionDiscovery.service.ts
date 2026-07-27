import { ethers } from "ethers";
import { provider } from "../config/chain";
import { env } from "../config/env";
import mockAavePoolAbi from "../config/abi/MockAavePool.json";

export interface AssetPosition {
    asset: string;
    symbol: string;
    decimals: number;
    collateralAmount: string; // raw, string to preserve precision over JSON
    collateralUSD: number;
    debtAmount: string;
    debtUSD: number;
}

export interface DiscoveredPosition {
    collateralAssets: AssetPosition[];
    debtAssets: AssetPosition[];
    totalCollateralUSD: number;
    totalDebtUSD: number;
}

/**
 * Discovers a user's ACTUAL position — whatever specific assets they hold,
 * in whatever combination — rather than assuming a fixed collateral/debt
 * pair. This is the core fix for the single-scenario hardcoding problem:
 * everything downstream (risk math, AI explanation, execution) now reasons
 * about real discovered data, not a predefined pair.
 */
export async function discoverPosition(walletAddress: string): Promise<DiscoveredPosition> {
    if (!env.MOCK_AAVE_POOL_ADDRESS) {
        throw new Error("MOCK_AAVE_POOL_ADDRESS is not configured — deploy contracts first");
    }

    const pool = new ethers.Contract(env.MOCK_AAVE_POOL_ADDRESS, mockAavePoolAbi as any, provider);

    const rawPositions = await pool.getUserPositions(walletAddress);

    const collateralAssets: AssetPosition[] = [];
    const debtAssets: AssetPosition[] = [];
    let totalCollateralUSD = 0;
    let totalDebtUSD = 0;

    for (const p of rawPositions) {
        const collateralUSD = Number(p.collateralUSD) / 1e18;
        const debtUSD = Number(p.debtUSD) / 1e18;

        if (p.collateralAmount > 0n) {
            collateralAssets.push({
                asset: p.asset,
                symbol: p.symbol,
                decimals: Number(p.decimals),
                collateralAmount: p.collateralAmount.toString(),
                collateralUSD,
                debtAmount: "0",
                debtUSD: 0,
            });
            totalCollateralUSD += collateralUSD;
        }

        if (p.debtAmount > 0n) {
            debtAssets.push({
                asset: p.asset,
                symbol: p.symbol,
                decimals: Number(p.decimals),
                collateralAmount: "0",
                collateralUSD: 0,
                debtAmount: p.debtAmount.toString(),
                debtUSD,
            });
            totalDebtUSD += debtUSD;
        }
    }

    return { collateralAssets, debtAssets, totalCollateralUSD, totalDebtUSD };
}