const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export interface AnalysisResult {
    analysisId: string;
    position: {
        totalCollateralUSD: number;
        totalDebtUSD: number;
        availableBorrowsUSD: number;
        liquidationThresholdPct: number;
        ltvPct: number;
        healthFactor: number | null;
        riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    };
    research: {
        protocolContext: string;
        marketNote: string;
        sources: string[];
    };
    explanation: string;
    recommendedAction: "REPAY" | "SUPPLY";
    actionRationale: string;
    preparedUserOp: unknown;
}

export async function runAnalysis(walletAddress: string): Promise<AnalysisResult> {
    const res = await fetch(`${API_BASE}/analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
    });

    if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(errorBody.message || `Analysis request failed: ${res.status}`);
    }

    return res.json();
}

export interface DeployAccountInfo {
    factoryAddress: string;
    factoryCallData: string;
    predictedAddress: string;
    alreadyDeployed: boolean;
}

export async function getDeployAccountInfo(walletAddress: string): Promise<DeployAccountInfo> {
    const res = await fetch(`${API_BASE}/wallet/deploy-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
    });

    if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(errorBody.message || `Deploy-account request failed: ${res.status}`);
    }

    return res.json();
}