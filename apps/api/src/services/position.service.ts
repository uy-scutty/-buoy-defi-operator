import { ethers } from "ethers";
import { provider } from "../config/chain";
import { env } from "../config/env";
import mockAavePoolAbi from "../config/abi/MockAavePool.json";

export interface PositionData {
    totalCollateralUSD: string; // returned as string to preserve full precision over JSON
    totalDebtUSD: string;
    availableBorrowsUSD: string;
    currentLiquidationThreshold: string; // basis points
    ltv: string;                          // basis points
    healthFactor: string;                 // 1e18-scaled, or max uint256 if no debt
}

/**
 * Reads a wallet's position data directly from MockAavePool. This is the
 * IPositionSource-style adapter described in the architecture doc — swapping
 * to the real Aave V3 Pool on X Layer mainnet later means changing only
 * MOCK_AAVE_POOL_ADDRESS and this file's ABI, not any calling code.
 */
export async function getPosition(walletAddress: string): Promise<PositionData> {
    if (!env.MOCK_AAVE_POOL_ADDRESS) {
        throw new Error("MOCK_AAVE_POOL_ADDRESS is not configured — deploy contracts first");
    }

    const pool = new ethers.Contract(env.MOCK_AAVE_POOL_ADDRESS, mockAavePoolAbi, provider);

    const result = await pool.getUserAccountData(walletAddress);

    return {
        totalCollateralUSD: result[0].toString(),
        totalDebtUSD: result[1].toString(),
        availableBorrowsUSD: result[2].toString(),
        currentLiquidationThreshold: result[3].toString(),
        ltv: result[4].toString(),
        healthFactor: result[5].toString(),
    };
}