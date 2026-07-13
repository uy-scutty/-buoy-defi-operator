import { runRiskAgent, RiskOutput } from "./risk.service";
import { runResearchAgent, ResearchOutput } from "./research.service";
import { runExecutionAgent, ExecutionOutput } from "./execution.service";
import { generateExplanation } from "../llm/gemini.provider";

export interface SupervisorOutput {
    risk: RiskOutput;
    research: ResearchOutput;
    explanation: string;
    recommendedAction: "REPAY" | "SUPPLY";
    actionRationale: string;
    execution: ExecutionOutput;
}

export async function runSupervisor(
    walletAddress: string,
    smartAccountAddress: string | null
): Promise<SupervisorOutput> {
    const risk: RiskOutput = await runRiskAgent(walletAddress);
    const research: ResearchOutput = await runResearchAgent(risk.riskLevel);
    const execution: ExecutionOutput = await runExecutionAgent(risk, smartAccountAddress);

    const explanation = await generateExplanationSafely(risk, research);
    const actionRationale = buildActionRationale(execution);

    return { risk, research, explanation, recommendedAction: execution.recommendedAction, actionRationale, execution };
}

/** Degrades gracefully to a templated explanation if the LLM call fails — matches
 *  the Backend Design doc's resiliency rule: no single agent failure should
 *  block the whole analysis. */
async function generateExplanationSafely(risk: RiskOutput, research: ResearchOutput): Promise<string> {
    try {
        return await generateExplanation(risk, research);
    } catch (error) {
        console.error("LLM explanation failed, falling back to templated explanation:", error);
        const hfText = risk.healthFactor === null ? "no active debt" : `a Health Factor of ${risk.healthFactor.toFixed(2)}`;
        return `Your position currently has ${hfText}, putting it in the ${risk.riskLevel} risk category. ${research.marketNote}`;
    }
}

function buildActionRationale(execution: ExecutionOutput): string {
    if (execution.recommendedAction === "REPAY") {
        return `Repaying $${execution.targetAmountUSD} would restore your Health Factor to a safer margin.`;
    }
    return `Supplying an additional $${execution.targetAmountUSD} in collateral would improve your safety margin.`;
}