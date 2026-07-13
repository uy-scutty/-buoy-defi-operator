"use client";

import { useEffect, useState } from "react";

const AGENTS = ["Risk", "Research", "Supervisor", "Execution"] as const;
type AgentName = (typeof AGENTS)[number];
type AgentState = "pending" | "active" | "done";

interface AgentStatusStripProps {
    isRunning: boolean;
    isComplete: boolean;
}

export function AgentStatusStrip({ isRunning, isComplete }: AgentStatusStripProps) {
    const [states, setStates] = useState<Record<AgentName, AgentState>>({
        Risk: "pending",
        Research: "pending",
        Supervisor: "pending",
        Execution: "pending",
    });

    useEffect(() => {
        if (!isRunning) return;

        setStates({ Risk: "pending", Research: "pending", Supervisor: "pending", Execution: "pending" });

        const timers: ReturnType<typeof setTimeout>[] = [];
        AGENTS.forEach((agent, i) => {
            timers.push(
                setTimeout(() => setStates((prev) => ({ ...prev, [agent]: "active" })), i * 500)
            );
            timers.push(
                setTimeout(() => setStates((prev) => ({ ...prev, [agent]: "done" })), i * 500 + 400)
            );
        });

        return () => timers.forEach(clearTimeout);
    }, [isRunning]);

    useEffect(() => {
        if (isComplete) {
            setStates({ Risk: "done", Research: "done", Supervisor: "done", Execution: "done" });
        }
    }, [isComplete]);

    return (
        <div className="flex gap-3 mb-8">
            {AGENTS.map((agent) => (
                <div
                    key={agent}
                    className="flex-1 border border-border rounded-lg px-4 py-3 transition-colors"
                    style={{
                        borderColor: states[agent] === "done" ? "var(--risk-low)" : states[agent] === "active" ? "var(--risk-medium)" : "var(--border)",
                    }}
                >
                    <p className="font-mono text-xs text-text-secondary mb-1">{agent} Agent</p>
                    <p
                        className="text-xs font-medium"
                        style={{
                            color: states[agent] === "done" ? "var(--risk-low)" : states[agent] === "active" ? "var(--risk-medium)" : "var(--text-secondary)",
                        }}
                    >
                        {states[agent] === "done" ? "Complete" : states[agent] === "active" ? "Running..." : "Waiting"}
                    </p>
                </div>
            ))}
        </div>
    );
}