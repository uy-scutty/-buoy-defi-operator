"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAccount, useConnect, useChainId, useSwitchChain } from "wagmi";
import { xLayerTestnet } from "@/lib/wagmi";
import { runAnalysis, AnalysisResult } from "@/lib/api";
import { AssetRow } from "@/components/AssetRow";
import { RiskGauge } from "@/components/RiskGauge";

export default function Dashboard() {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    const { address, isConnected } = useAccount();
    const chainId = useChainId();
    const { switchChain, isPending: isSwitching } = useSwitchChain();
    const { connect, connectors, error: connectError } = useConnect();

    const [result, setResult] = useState<AnalysisResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isConnected || !address || chainId !== xLayerTestnet.id) return;

        setLoading(true);
        setError(null);

        runAnalysis(address)
            .then(setResult)
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, [isConnected, address, chainId]);

    if (!mounted) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="font-mono text-text-secondary animate-pulse">Loading...</p>
            </div>
        );
    }

    if (!isConnected) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4">
                <p className="text-text-secondary">Connect your wallet to see your position.</p>
                <button
                    onClick={() => connect({ connector: connectors[0] })}
                    className="font-sans font-bold px-6 py-2 rounded-full"
                    style={{ backgroundColor: "var(--brand-cyan)", color: "#0B0620" }}
                >
                    Connect wallet
                </button>
                {connectError && <p className="text-risk-critical text-sm font-mono">{connectError.message}</p>}
            </div>
        );
    }

    if (chainId !== xLayerTestnet.id) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6">
                <p style={{ color: "var(--risk-medium)" }} className="font-medium">Wrong network</p>
                <p className="text-text-secondary text-sm text-center max-w-sm">
                    Buoy needs X Layer Testnet (chain ID {xLayerTestnet.id}) to read your position.
                </p>
                <button
                    onClick={() => switchChain({ chainId: xLayerTestnet.id })}
                    disabled={isSwitching}
                    className="font-sans font-bold px-6 py-2 rounded-full disabled:opacity-50"
                    style={{ backgroundColor: "var(--risk-medium)", color: "#0B0620" }}
                >
                    {isSwitching ? "Switching..." : "Switch to X Layer Testnet"}
                </button>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="font-mono text-text-secondary animate-pulse">Reading your position...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center px-6">
                <div className="max-w-md text-center">
                    <p style={{ color: "var(--risk-critical)" }} className="font-medium mb-2">Something failed</p>
                    <p className="text-text-secondary text-sm font-mono">{error}</p>
                </div>
            </div>
        );
    }

    if (!result) return null;

    const { position } = result;
    const hasPosition = position.collateralAssets.length > 0 || position.debtAssets.length > 0;

    return (
        <div className="min-h-screen px-6 py-12 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <p className="font-mono text-sm text-text-secondary">{address}</p>
                <Link
                    href="/settings"
                    className="font-mono text-sm px-4 py-1.5 rounded-full glass-panel hover:opacity-80 transition-opacity"
                >
                    Settings
                </Link>
            </div>

            {!hasPosition ? (
                <motion.div
                    className="glass-panel rounded-2xl p-8 text-center"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <p className="text-text-primary font-medium mb-2">No active position yet</p>
                    <p className="text-text-secondary text-sm">
                        Supply collateral or borrow on a supported pool, then come back — Buoy will start watching automatically.
                    </p>
                </motion.div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1">
                        <RiskGauge healthFactor={position.healthFactor} riskLevel={position.riskLevel} />
                    </div>

                    <div className="md:col-span-2 flex flex-col gap-4">
                        <motion.div
                            className="glass-panel rounded-2xl p-6"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.1 }}
                        >
                            <p className="text-text-secondary text-sm mb-2">Explanation</p>
                            <p className="text-text-primary leading-relaxed">{result.explanation}</p>
                        </motion.div>

                        {result.recommendedAction !== "NONE" && (
                            <motion.div
                                className="glass-panel rounded-2xl p-6"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.15 }}
                            >
                                <p className="text-text-secondary text-sm mb-2">Recommended action</p>
                                <p className="font-bold mb-1" style={{ color: "var(--brand-cyan)" }}>{result.recommendedAction}</p>
                                <p className="text-text-secondary text-sm">{result.actionRationale}</p>
                            </motion.div>
                        )}
                    </div>

                    <div className="md:col-span-3">
                        <p className="text-text-secondary text-sm mb-3 mt-2">Collateral</p>
                        <div className="flex flex-col gap-2 mb-6">
                            {position.collateralAssets.length === 0 ? (
                                <p className="text-text-secondary text-sm font-mono">None</p>
                            ) : (
                                position.collateralAssets.map((a, i) => (
                                    <AssetRow key={a.asset} symbol={a.symbol} usdValue={a.collateralUSD} type="collateral" index={i} />
                                ))
                            )}
                        </div>

                        <p className="text-text-secondary text-sm mb-3">Debt</p>
                        <div className="flex flex-col gap-2">
                            {position.debtAssets.length === 0 ? (
                                <p className="text-text-secondary text-sm font-mono">None</p>
                            ) : (
                                position.debtAssets.map((a, i) => (
                                    <AssetRow key={a.asset} symbol={a.symbol} usdValue={a.debtUSD} type="debt" index={i} />
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}