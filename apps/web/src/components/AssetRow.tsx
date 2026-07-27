"use client";

import { motion } from "framer-motion";

interface AssetRowProps {
    symbol: string;
    usdValue: number;
    type: "collateral" | "debt";
    index: number;
}

export function AssetRow({ symbol, usdValue, type, index }: AssetRowProps) {
    const accentColor = type === "collateral" ? "var(--risk-low)" : "var(--risk-high)";

    return (
        <motion.div
            className="flex items-center justify-between rounded-xl px-4 py-3 glass-panel"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 + index * 0.08, duration: 0.4, ease: "easeOut" }}
            whileHover={{ scale: 1.01 }}
            style={{ borderLeft: `3px solid ${accentColor}` }}
        >
            <div className="flex items-center gap-3">
                <div
                    className="w-8 h-8 rounded-full flex items-center justify-center font-mono text-xs font-bold"
                    style={{ background: `${accentColor}22`, color: accentColor }}
                >
                    {symbol.slice(0, 2)}
                </div>
                <span className="font-medium">{symbol}</span>
            </div>
            <span className="font-mono text-text-secondary">
                ${usdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
        </motion.div>
    );
}