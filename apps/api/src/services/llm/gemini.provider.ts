import { env } from "../../config/env";
import { RiskOutput } from "../agents/risk.service";
import { ResearchOutput } from "../agents/research.service";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let client: any = null;

async function getClient() {
    if (!env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not configured");
    }
    if (!client) {
        const { GoogleGenAI } = await import("@google/genai");
        client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    }
    return client;
}

export async function generateExplanation(risk: RiskOutput, research: ResearchOutput): Promise<string> {
    const ai = await getClient();

    const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: buildPrompt(risk, research),
        config: {
            systemInstruction:
                "You are Buoy, an AI DeFi operations engineer. Explain a user's lending position risk in clear, plain English — like a calm, competent operations engineer briefing a colleague, not a chatbot. The user may hold MULTIPLE collateral and debt assets — reference the specific assets by name where it helps, not just totals. Keep it to 2-4 sentences. Be direct and confident; this is a risk briefing, not investment advice, so don't hedge excessively.",
            temperature: 0.4,
            maxOutputTokens: 250,
        },
    });

    const text = response.text;
    if (!text) throw new Error("Gemini returned an empty response");
    return text.trim();
}

function buildPrompt(risk: RiskOutput, research: ResearchOutput): string {
    if (risk.collateralAssets.length === 0 && risk.debtAssets.length === 0) {
        return "This wallet has no active collateral or debt position yet. Write one short sentence welcoming the user and explaining that Buoy will begin monitoring once they supply collateral or borrow.";
    }

    const hfText =
        risk.healthFactor === null
            ? "no active debt (effectively infinite Health Factor)"
            : `a Health Factor of ${risk.healthFactor.toFixed(2)}`;

    const collateralList = risk.collateralAssets.length > 0
        ? risk.collateralAssets.map((a) => `${a.symbol} ($${a.collateralUSD.toFixed(2)})`).join(", ")
        : "none";

    const debtList = risk.debtAssets.length > 0
        ? risk.debtAssets.map((a) => `${a.symbol} ($${a.debtUSD.toFixed(2)})`).join(", ")
        : "none";

    return `Position summary:
- Collateral assets: ${collateralList}
- Debt assets: ${debtList}
- Total Collateral: $${risk.totalCollateralUSD.toFixed(2)}
- Total Debt: $${risk.totalDebtUSD.toFixed(2)}
- Weighted Loan-to-Value: ${risk.ltvPct.toFixed(1)}%
- Weighted Liquidation Threshold: ${risk.liquidationThresholdPct.toFixed(1)}%
- Health Factor: ${hfText}
- Risk Level: ${risk.riskLevel}

Additional context: ${research.marketNote}

Explain this position's risk in plain English, mentioning the specific assets involved, and note what matters most right now.`;
}