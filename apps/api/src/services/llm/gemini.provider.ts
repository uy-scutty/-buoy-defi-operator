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
                "You are Sentinel, an AI DeFi operations engineer. Explain a user's lending position risk in clear, plain English — like a calm, competent operations engineer briefing a colleague, not a chatbot. Reference the actual numbers given. Keep it to 2-3 sentences. Be direct and confident; this is a risk briefing, not investment advice, so don't hedge excessively.",
            temperature: 0.4,
            maxOutputTokens: 200,
        },
    });

    const text = response.text;
    if (!text) throw new Error("Gemini returned an empty response");
    return text.trim();
}

function buildPrompt(risk: RiskOutput, research: ResearchOutput): string {
    const hfText =
        risk.healthFactor === null
            ? "no active debt (effectively infinite Health Factor)"
            : `a Health Factor of ${risk.healthFactor.toFixed(2)}`;

    return `Position summary:
- Total Collateral: $${risk.totalCollateralUSD.toFixed(2)}
- Total Debt: $${risk.totalDebtUSD.toFixed(2)}
- Loan-to-Value: ${risk.ltvPct}%
- Liquidation Threshold: ${risk.liquidationThresholdPct}%
- Health Factor: ${hfText}
- Risk Level: ${risk.riskLevel}

Additional context: ${research.marketNote}

Explain this position's risk in plain English and note what matters most right now.`;
}