"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { BUOY_VAULT_ADDRESS, ERC20_ABI, VAULT_ABI, TEST_TOKENS } from "@/lib/vault";

export function VaultDeposit() {
    const { address } = useAccount();
    const [selectedToken, setSelectedToken] = useState(TEST_TOKENS[2]);
    const [amount, setAmount] = useState("");

    const { data: balance } = useReadContract({
        address: selectedToken.address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: address ? [address] : undefined,
    });

    const { data: allowance, refetch: refetchAllowance } = useReadContract({
        address: selectedToken.address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: address ? [address, BUOY_VAULT_ADDRESS] : undefined,
    });

    const { writeContract: approve, data: approveHash, isPending: isApproving, error: approveError } = useWriteContract();
    const { isSuccess: approveConfirmed } = useWaitForTransactionReceipt({ hash: approveHash });

    const { writeContract: deposit, data: depositHash, isPending: isDepositing, error: depositError } = useWriteContract();
    const { isSuccess: depositConfirmed } = useWaitForTransactionReceipt({ hash: depositHash });

    const amountRaw = amount
        ? BigInt(Math.floor(parseFloat(amount) * 10 ** selectedToken.decimals))
        : BigInt(0);

    // Safe default: if we don't yet know the allowance, ASSUME approval is
    // needed, rather than silently allowing a deposit attempt with unknown
    // (possibly zero) allowance — this was the actual bug causing silent failures.
    const needsApproval = allowance === undefined || amountRaw > (allowance as bigint);

    function handleApprove() {
        approve({
            address: selectedToken.address as `0x${string}`,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [BUOY_VAULT_ADDRESS as `0x${string}`, amountRaw],
        });
    }
    function handleDeposit() {
        deposit({
            address: BUOY_VAULT_ADDRESS as `0x${string}`,
            abi: VAULT_ABI,
            functionName: "deposit",
            args: [selectedToken.address as `0x${string}`, amountRaw],
        });
    }

    const formattedBalance = balance !== undefined ? Number(balance) / 10 ** selectedToken.decimals : 0;

    return (
        <motion.div
            className="glass-panel rounded-2xl p-6"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
        >
            <p className="font-medium mb-1">Deposit to protection vault</p>
            <p className="text-text-secondary text-sm mb-4">
                Buoy can only use funds you deposit here — never your wallet balance directly.
            </p>

            <div className="flex gap-2 mb-4">
                {TEST_TOKENS.map((token) => (
                    <button
                        key={token.symbol}
                        onClick={() => setSelectedToken(token)}
                        className="px-3 py-1.5 rounded-full text-sm font-mono transition-colors"
                        style={{
                            backgroundColor: selectedToken.symbol === token.symbol ? "var(--brand-cyan)" : "rgba(255,255,255,0.06)",
                            color: selectedToken.symbol === token.symbol ? "#0B0620" : "var(--text-secondary)",
                        }}
                    >
                        {token.symbol}
                    </button>
                ))}
            </div>

            <p className="text-text-secondary text-xs font-mono mb-2">
                Wallet balance: {formattedBalance.toFixed(4)} {selectedToken.symbol}
            </p>

            <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-transparent border rounded-xl px-4 py-3 font-mono mb-4 focus:outline-none"
                style={{ borderColor: "var(--panel-border)" }}
            />

            {depositConfirmed ? (
                <p className="font-mono text-sm" style={{ color: "var(--risk-low)" }}>✓ Deposited successfully</p>
            ) : needsApproval ? (
                <button
                    onClick={async () => {
                        handleApprove();
                    }}
                    disabled={!amount || isApproving}
                    className="w-full font-bold py-3 rounded-full disabled:opacity-50"
                    style={{ backgroundColor: "var(--brand-violet)", color: "white" }}
                >
                    {isApproving ? "Approving..." : approveConfirmed ? "Approved — click Deposit" : `Approve ${selectedToken.symbol}`}
                </button>
            ) : (
                <button
                    onClick={handleDeposit}
                    disabled={!amount || isDepositing}
                    className="w-full font-bold py-3 rounded-full disabled:opacity-50"
                    style={{ backgroundColor: "var(--brand-cyan)", color: "#0B0620" }}
                >
                    {isDepositing ? "Depositing..." : "Deposit"}
                </button>
            )}

            {approveConfirmed && !depositConfirmed && (
                <button
                    onClick={() => refetchAllowance()}
                    className="w-full mt-2 text-xs font-mono text-text-secondary underline"
                >
                    Refresh allowance
                </button>
            )}

            {(approveError || depositError) && (
                <p className="font-mono text-xs mt-3" style={{ color: "var(--risk-critical)" }}>
                    {(approveError || depositError)?.message?.slice(0, 200)}
                </p>
            )}
        </motion.div>
    );
}