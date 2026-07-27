const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export interface AssetPosition {
    asset: string;
    symbol: string;
    decimals: number;
    collateralAmount: string;
    collateralUSD: number;
    debtAmount: string;
    debtUSD: number;
}

export interface AnalysisResult {
    analysisId: string;
    position: {
        collateralAssets: AssetPosition[];
        debtAssets: AssetPosition[];
        totalCollateralUSD: number;
        totalDebtUSD: number;
        ltvPct: number;
        liquidationThresholdPct: number;
        healthFactor: number | null;
        riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    };
    research: {
        protocolContext: string;
        marketNote: string;
        sources: string[];
    };
    explanation: string;
    recommendedAction: "REPAY" | "SUPPLY" | "NONE";
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

export interface Settings {
    automationEnabled: boolean;
    healthFactorThreshold: number;
}

export async function getSettings(walletAddress: string): Promise<Settings> {
    const res = await fetch(`${API_BASE}/settings?walletAddress=${walletAddress}`);
    if (!res.ok) throw new Error(`Failed to load settings: ${res.status}`);
    return res.json();
}

export async function updateSettings(walletAddress: string, updates: Partial<Settings>): Promise<Settings> {
    const res = await fetch(`${API_BASE}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, ...updates }),
    });
    if (!res.ok) throw new Error(`Failed to update settings: ${res.status}`);
    return res.json();
}