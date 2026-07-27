import { ethers } from "ethers";
import { provider } from "../config/chain";
import { env } from "../config/env";
import { prisma } from "../config/prisma";
import mockAavePoolAbi from "../config/abi/MockAavePool.json";
import buoyVaultAbi from "../config/abi/BuoyVault.json";
import { discoverPosition } from "../services/positionDiscovery.service";

const CHECK_INTERVAL_MS = 60_000; // check every 60 seconds

let automationWallet: ethers.Wallet | null = null;

function getAutomationWallet(): ethers.Wallet {
    if (!env.AUTOMATION_PRIVATE_KEY) {
        throw new Error("AUTOMATION_PRIVATE_KEY is not configured — the Watcher cannot sign transactions");
    }
    if (!automationWallet) {
        automationWallet = new ethers.Wallet(env.AUTOMATION_PRIVATE_KEY, provider);
    }
    return automationWallet;
}

/**
 * The Watcher: runs continuously in the background, checking every enrolled
 * user's real Health Factor. If it drops below that user's own configured
 * threshold, triggers a protective action via BuoyVault — using ONLY that
 * user's own deposited funds, capped at their own daily limit (enforced
 * on-chain by the Vault itself, not trusted client-side).
 */
export function startWatcher(): void {
    console.log(`🔭 Watcher started — checking positions every ${CHECK_INTERVAL_MS / 1000}s`);
    setInterval(runWatcherCycle, CHECK_INTERVAL_MS);
    // Also run once immediately on startup, rather than waiting a full interval.
    runWatcherCycle().catch((err) => console.error("Watcher cycle failed:", err));
}

async function runWatcherCycle(): Promise<void> {
    if (!env.MOCK_AAVE_POOL_ADDRESS || !env.BUOY_VAULT_ADDRESS) {
        console.warn("Watcher: MOCK_AAVE_POOL_ADDRESS or BUOY_VAULT_ADDRESS not configured, skipping cycle");
        return;
    }

    const enrolledUsers = await prisma.user.findMany({
        where: { automationEnabled: true },
    });

    if (enrolledUsers.length === 0) return;

    console.log(`Watcher: checking ${enrolledUsers.length} enrolled user(s)`);

    for (const user of enrolledUsers) {
        try {
            await checkAndProtectUser(user.walletAddress, user.healthFactorThreshold);
        } catch (error) {
            // One user's failure must never stop the Watcher from checking everyone else.
            console.error(`Watcher: failed to process ${user.walletAddress}:`, error);
        }
    }
}

async function checkAndProtectUser(walletAddress: string, threshold: number): Promise<void> {
    const pool = new ethers.Contract(env.MOCK_AAVE_POOL_ADDRESS!, mockAavePoolAbi as any, provider);
    const result = await pool.getUserAccountData(walletAddress);

    const rawHealthFactor: bigint = result[5];
    if (rawHealthFactor === ethers.MaxUint256) return; // no debt, nothing to protect

    const healthFactor = Number(rawHealthFactor) / 1e18;

    if (healthFactor >= threshold) return; // safe, no action needed

    console.log(`⚠️ ${walletAddress} Health Factor ${healthFactor.toFixed(3)} below threshold ${threshold} — attempting protection`);

    const position = await discoverPosition(walletAddress);
    if (position.debtAssets.length === 0) return;

    const largestDebt = [...position.debtAssets].sort((a, b) => b.debtUSD - a.debtUSD)[0];

    const wallet = getAutomationWallet();
    const vault = new ethers.Contract(env.BUOY_VAULT_ADDRESS!, buoyVaultAbi as any, wallet);

    const vaultBalance: bigint = await vault.getBalance(walletAddress, largestDebt.asset);
    if (vaultBalance === 0n) {
        console.warn(`Watcher: ${walletAddress} has no Vault buffer for ${largestDebt.symbol} — cannot protect`);
        return;
    }

    const remainingAllowance: bigint = await vault.getRemainingDailyAllowance(walletAddress, largestDebt.asset);
    const amountToUse = vaultBalance < remainingAllowance ? vaultBalance : remainingAllowance;

    if (amountToUse === 0n) {
        console.warn(`Watcher: ${walletAddress} has no remaining daily allowance for ${largestDebt.symbol}`);
        return;
    }

    const tx = await vault.executeProtectiveAction(
        walletAddress,
        largestDebt.asset,
        amountToUse,
        0, // ActionType.REPAY
        env.MOCK_AAVE_POOL_ADDRESS
    );
    await tx.wait();

    console.log(`✅ Protected ${walletAddress} — repaid ${largestDebt.symbol} via Vault. Tx: ${tx.hash}`);
}