"use client";

import { useEffect, useState } from "react";
import { runAnalysis, getDeployAccountInfo, AnalysisResult, DeployAccountInfo } from "@/lib/api";
import { useAccount, useConnect, useChainId, useSwitchChain, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { xLayerTestnet } from "@/lib/wagmi";
import { AgentStatusStrip } from "@/components/AgentStatusStrip";
import { ExecutionPreview } from "@/components/ExecutionPreview";

export const dynamic = "force-dynamic";

type Stage = "checking-account" | "needs-deploy" | "deploying" | "confirming" | "analyzing" | "done";

export default function Dashboard() {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    const { address, isConnected } = useAccount();
    const chainId = useChainId();
    const { switchChain, isPending: isSwitching } = useSwitchChain();
    const { connect, connectors, error: connectError } = useConnect();
    const { sendTransaction, data: txHash, isPending: isSending, error: sendError } = useSendTransaction();
    const { isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

    const [stage, setStage] = useState<Stage>("checking-account");
    const [accountInfo, setAccountInfo] = useState<DeployAccountInfo | null>(null);
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Step 1: check whether the smart account already exists
    useEffect(() => {
        if (!isConnected || !address || chainId !== xLayerTestnet.id) return;

        setStage("checking-account");
        setError(null);

        getDeployAccountInfo(address)
            .then((info) => {
                setAccountInfo(info);
                setStage(info.alreadyDeployed ? "analyzing" : "needs-deploy");
            })
            .catch((err) => setError(err.message));
    }, [isConnected, address, chainId]);

    // Step 2: once the deploy transaction confirms, re-check deployment status
    useEffect(() => {
        if (!isConfirmed || !address) return;

        setStage("confirming");
        getDeployAccountInfo(address)
            .then((info) => {
                setAccountInfo(info);
                setStage("analyzing");
            })
            .catch((err) => setError(err.message));
    }, [isConfirmed, address]);

    // Step 3: run the analysis once we know the account state
    useEffect(() => {
        if (stage !== "analyzing" || !address) return;

        runAnalysis(address)
            .then((res) => {
                setResult(res);
                setStage("done");
            })
            .catch((err) => setError(err.message));
    }, [stage, address]);

    function handleDeploy() {
        if (!accountInfo) return;
        setStage("deploying");
        sendTransaction({
            to: accountInfo.factoryAddress as `0x${string}`,
            data: accountInfo.factoryCallData as `0x${string}`,
        });
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
            <div className="min-h-screen flex flex-col items-center justify-center gap-4">
                <p className="text-text-secondary">Please connect your wallet first.</p>
                <button
                    onClick={() => connect({ connector: connectors[0] })}
                    className="font-sans font-medium bg-risk-low text-background px-6 py-2 rounded-full hover:opacity-90 transition-opacity"
                >
                    Connect Wallet
                </button>
                {connectError && (
                    <p className="text-risk-critical text-sm font-mono mt-2 max-w-md text-center">{connectError.message}</p>
                )}
            </div>
        );
    }

    if (chainId !== xLayerTestnet.id) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6">
                <p className="text-risk-medium font-medium">Wrong network</p>
                <p className="text-text-secondary text-sm text-center max-w-sm">
                    Buoy needs to be connected to X Layer Testnet (chain ID {xLayerTestnet.id}) to read your position.
                </p>
                <button
                    onClick={() => switchChain({ chainId: xLayerTestnet.id })}
                    disabled={isSwitching}
                    className="font-sans font-medium bg-risk-medium text-background px-6 py-2 rounded-full hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                    {isSwitching ? "Switching..." : "Switch to X Layer Testnet"}
                </button>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center px-6">
                <div className="max-w-md text-center">
                    <p className="text-risk-critical font-medium mb-2">Something failed</p>
                    <p className="text-text-secondary text-sm font-mono">{error}</p>
                </div>
            </div>
        );
    }

    if (stage === "checking-account") {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="font-mono text-text-secondary animate-pulse">Checking smart account...</p>
            </div>
        );
    }

    if (stage === "needs-deploy") {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6">
                <p className="text-text-primary font-medium">No Buoy smart account yet</p>
                <p className="text-text-secondary text-sm text-center max-w-md">
                    Deploy your Buoy smart account to enable prepared, signable transactions.
                    Predicted address: <span className="font-mono text-xs">{accountInfo?.predictedAddress}</span>
                </p>
                <button
                    onClick={handleDeploy}
                    disabled={isSending}
                    className="font-sans font-medium bg-risk-low text-background px-6 py-2 rounded-full hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                    {isSending ? "Confirm in wallet..." : "Deploy Smart Account"}
                </button>
                {sendError && <p className="text-risk-critical text-sm font-mono">{sendError.message}</p>}
            </div>
        );
    }

    if (stage === "deploying" || stage === "confirming") {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="font-mono text-text-secondary animate-pulse">
                    {stage === "deploying" ? "Deploying smart account..." : "Confirming on-chain..."}
                </p>
            </div>
        );
    }

    if (stage === "analyzing") {
        return (
            <div className="min-h-screen px-6 py-12 max-w-4xl mx-auto">
                <AgentStatusStrip isRunning={true} isComplete={false} />
                <p className="font-mono text-text-secondary text-center animate-pulse">Analyzing position...</p>
            </div>
        );
    }

    if (!result) return null;

    return (
        <div className="min-h-screen px-6 py-12 max-w-4xl mx-auto">
            <p className="font-mono text-sm text-text-secondary mb-8">{address}</p>

            <AgentStatusStrip isRunning={false} isComplete={true} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-panel border border-border rounded-xl p-6">
                    <p className="text-text-secondary text-sm mb-2">Health Factor</p>
                    <p className="font-mono text-4xl font-medium text-text-primary">
                        {result.position.healthFactor?.toFixed(2) ?? "∞"}
                    </p>
                    <p className="text-sm mt-2" style={{ color: `var(--risk-${result.position.riskLevel.toLowerCase()})` }}>
                        {result.position.riskLevel}
                    </p>
                </div>

                <div className="bg-panel border border-border rounded-xl p-6">
                    <p className="text-text-secondary text-sm mb-2">Collateral / Debt</p>
                    <p className="font-mono text-2xl text-text-primary">
                        ${result.position.totalCollateralUSD.toFixed(2)} / ${result.position.totalDebtUSD.toFixed(2)}
                    </p>
                </div>

                <div className="bg-panel border border-border rounded-xl p-6 md:col-span-2">
                    <p className="text-text-secondary text-sm mb-2">Explanation</p>
                    <p className="text-text-primary leading-relaxed">{result.explanation}</p>
                </div>

                <div className="bg-panel border border-border rounded-xl p-6 md:col-span-2">
                    <p className="text-text-secondary text-sm mb-2">Recommended Action</p>
                    <p className="text-text-primary font-medium mb-1">{result.recommendedAction}</p>
                    <p className="text-text-secondary text-sm">{result.actionRationale}</p>
                </div>

                <ExecutionPreview
                    preparedUserOp={result.preparedUserOp as any}
                    recommendedAction={result.recommendedAction}
                />
            </div>
        </div>
    );
}