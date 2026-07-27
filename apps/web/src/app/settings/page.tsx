"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAccount } from "wagmi";
import { getSettings, updateSettings, Settings } from "@/lib/api";
import { VaultDeposit } from "@/components/VaultDeposit";
import { useChainId, useSwitchChain } from "wagmi";
import { xLayerTestnet } from "@/lib/wagmi";

export default function SettingsPage() {
    const { address, isConnected } = useAccount();
    const [settings, setSettings] = useState<Settings | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [mounted, setMounted] = useState(false);
    const chainId = useChainId();
    const { switchChain, isPending: isSwitching } = useSwitchChain();

    useEffect(() => setMounted(true), []);
    useEffect(() => {
        if (!address) return;
        setLoading(true);
        getSettings(address)
            .then(setSettings)
            .finally(() => setLoading(false));
    }, [address]);

    async function handleSave() {
        if (!address || !settings) return;
        setSaving(true);
        setSaved(false);
        try {
            const updated = await updateSettings(address, settings);
            setSettings(updated);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } finally {
            setSaving(false);
        }
    }

    if (!mounted) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="font-mono text-text-secondary animate-pulse">Loading...</p>
            </div>
        );
    }

    if (!isConnected) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-text-secondary">Connect your wallet to manage settings.</p>
            </div>
        );
    }

    if (chainId !== xLayerTestnet.id) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6">
                <p style={{ color: "var(--risk-medium)" }} className="font-medium">Wrong network</p>
                <p className="text-text-secondary text-sm text-center max-w-sm">
                    Buoy needs X Layer Testnet (chain ID {xLayerTestnet.id}) for deposits and settings.
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

    if (loading || !settings) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="font-mono text-text-secondary animate-pulse">Loading settings...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen px-6 py-12 max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <Link href="/dashboard" className="font-mono text-sm text-text-secondary hover:text-text-primary transition-colors">
                    ← Back to dashboard
                </Link>
            </div>

            <motion.h1
                className="font-display text-3xl font-bold mb-2"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
            >
                Protection settings
            </motion.h1>
            <p className="text-text-secondary mb-8">
                Buoy can automatically protect you from liquidation, using funds you deposit ahead of time.
            </p>

            <motion.div
                className="glass-panel rounded-2xl p-6 mb-6"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
            >
                <div className="flex items-center justify-between mb-2">
                    <div>
                        <p className="font-medium">Automatic protection</p>
                        <p className="text-text-secondary text-sm">Let Buoy act on your behalf when your risk crosses your threshold.</p>
                    </div>
                    <button
                        onClick={() => setSettings({ ...settings, automationEnabled: !settings.automationEnabled })}
                        className="w-12 h-7 rounded-full relative transition-colors flex-shrink-0"
                        style={{ backgroundColor: settings.automationEnabled ? "var(--brand-cyan)" : "rgba(255,255,255,0.15)" }}
                    >
                        <motion.div
                            className="w-5 h-5 rounded-full bg-white absolute top-1"
                            animate={{ left: settings.automationEnabled ? 26 : 4 }}
                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        />
                    </button>
                </div>
            </motion.div>

            <motion.div
                className="glass-panel rounded-2xl p-6 mb-6"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
            >
                <p className="font-medium mb-1">Health factor threshold</p>
                <p className="text-text-secondary text-sm mb-4">
                    Protect me if my Health Factor drops below this value.
                </p>
                <div className="flex items-center gap-4">
                    <input
                        type="range"
                        min="1.05"
                        max="2.5"
                        step="0.05"
                        value={settings.healthFactorThreshold}
                        onChange={(e) => setSettings({ ...settings, healthFactorThreshold: parseFloat(e.target.value) })}
                        className="flex-1"
                    />
                    <span className="font-mono text-lg font-bold w-16 text-right" style={{ color: "var(--brand-cyan)" }}>
                        {settings.healthFactorThreshold.toFixed(2)}
                    </span>
                </div>
            </motion.div>

            <div className="mb-6">
                <VaultDeposit />
            </div>

            <motion.button
                onClick={handleSave}
                disabled={saving}
                className="font-sans font-bold px-6 py-3 rounded-full disabled:opacity-50"
                style={{ backgroundColor: "var(--brand-cyan)", color: "#0B0620" }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
            >
                {saving ? "Saving..." : saved ? "Saved ✓" : "Save settings"}
            </motion.button>
        </div>
    );
}