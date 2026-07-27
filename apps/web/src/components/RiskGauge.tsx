"use client";

import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useState } from "react";

interface RiskGaugeProps {
    healthFactor: number | null;
    riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

const RISK_COLORS: Record<string, string> = {
    LOW: "var(--risk-low)",
    MEDIUM: "var(--risk-medium)",
    HIGH: "var(--risk-high)",
    CRITICAL: "var(--risk-critical)",
};

export function RiskGauge({ healthFactor, riskLevel }: RiskGaugeProps) {
    const color = RISK_COLORS[riskLevel];
    const [displayValue, setDisplayValue] = useState(0);
    const motionValue = useMotionValue(0);

    useEffect(() => {
        if (healthFactor === null) return;
        const controls = animate(motionValue, healthFactor, {
            duration: 1,
            ease: "easeOut",
            onUpdate: (v) => setDisplayValue(v),
        });
        return () => controls.stop();
    }, [healthFactor, motionValue]);

    // Gauge fill: cap the visual scale at HF=3.0 for a sensible arc, clamp below that
    const fillPct = healthFactor === null ? 100 : Math.min((healthFactor / 3) * 100, 100);

    return (
        <div className="glass-panel rounded-2xl p-6 flex flex-col items-center">
            <p className="text-sm text-text-secondary mb-4">Health factor</p>

            <div className="relative w-40 h-40 mb-2">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
                    <motion.circle
                        cx="50"
                        cy="50"
                        r="42"
                        fill="none"
                        stroke={color}
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 42}
                        initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                        animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - fillPct / 100) }}
                        transition={{ duration: 1, ease: "easeOut" }}
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-mono text-3xl font-bold" style={{ color }}>
                        {healthFactor === null ? "∞" : displayValue.toFixed(2)}
                    </span>
                </div>
            </div>

            <span
                className="font-mono text-sm font-bold px-3 py-1 rounded-full"
                style={{ background: `${color}22`, color }}
            >
                {riskLevel}
            </span>
        </div>
    );
}