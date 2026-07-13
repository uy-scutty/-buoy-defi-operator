import OpenAI from "openai";
import { env } from "../../config/env";
import { RiskOutput } from "../agents/risk.service";
import { ResearchOutput } from "../agents/research.service";

let client: OpenAI | null = null;

function getClient(): OpenAI {
    if (!env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY is not configured");
    }
    if (!client) {
        client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    }
    return client;
}

/**
 * Generates the Supervisor's plain-English explanation. Thin wrapper around
 * the OpenAI SDK so the provider is swappable later without touching the
 * Supervisor's orchestration logic, per the Backend Design doc.
 */
export async function generateExplanation(risk: RiskOutput, research: ResearchOutput): Promise<string> {
    const openai = getClient();

    const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            {
                role: "system",
                content:
                    "You are Sentinel, an AI DeFi operations engineer. Explain a user's lending position risk in clear, plain English — like a calm, competent operations engineer briefing a colleague, not a chatbot. Reference the actual numbers given. Keep it to 2-3 sentences. Be direct and confident; this is a risk briefing, not investment advice, so don't hedge excessively.",
            },
            { role: "user", content: buildPrompt(risk, research) },
        ],
        temperature: 0.4,
        max_tokens: 200,
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) throw new Error("OpenAI returned an empty response");
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