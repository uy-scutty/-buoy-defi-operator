import { RiskLevel } from "./risk.service";

export interface ResearchOutput {
    protocolContext: string;
    marketNote: string;
    sources: string[];
}

/**
 * Research Agent: gathers supporting context for the Supervisor's synthesis.
 * For MVP, this is static/templated content keyed off risk level rather than
 * a live external API call — keeps the demo reliable and avoids depending on
 * an unverified third-party news/data API mid-hackathon. Structured so a
 * real external call (protocol docs, governance feed, market data) can
 * replace the body of this function later without touching callers.
 */
export async function runResearchAgent(riskLevel: RiskLevel): Promise<ResearchOutput> {
    const protocolContext =
        "This position is tracked against a lending pool modeled on Aave V3's risk parameters: " +
        "collateral value is weighted by each asset's liquidation threshold to determine the " +
        "safety margin before liquidation becomes possible.";

    const marketNote = buildMarketNote(riskLevel);

    return {
        protocolContext,
        marketNote,
        sources: ["Aave V3 Documentation (interface reference)"],
    };
}

function buildMarketNote(riskLevel: RiskLevel): string {
    switch (riskLevel) {
        case "CRITICAL":
            return "Health Factor is at or near the liquidation threshold. Any further drop in collateral value or increase in debt could trigger liquidation immediately.";
        case "HIGH":
            return "Health Factor has limited buffer remaining. Market volatility in the collateral asset could push this position toward liquidation risk within a short window.";
        case "MEDIUM":
            return "Health Factor has a moderate safety margin, but is worth monitoring if collateral asset volatility increases.";
        case "LOW":
        default:
            return "Health Factor has a healthy safety margin under current market conditions.";
    }
}
