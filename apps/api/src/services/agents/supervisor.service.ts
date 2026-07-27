import { runRiskAgent, RiskOutput } from "./risk.service";
import { runResearchAgent, ResearchOutput } from "./research.service";
import { runExecutionAgent, ExecutionOutput, RecommendedAction } from "./execution.service";
import { generateExplanation } from "../llm/gemini.provider";

export interface SupervisorOutput {
    risk: RiskOutput;
    research: ResearchOutput;
    explanation: string;
    recommendedAction: RecommendedAction;
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
    const actionRationale = buildActionRationale(execution, risk);

    return { risk, research, explanation, recommendedAction: execution.recommendedAction, actionRationale, execution };
}

async function generateExplanationSafely(risk: RiskOutput, research: import("./research.service").ResearchOutput): Promise<string> {
    try {
        return await generateExplanation(risk, research);
    } catch (error) {
        console.error("LLM explanation failed, falling back to templated explanation:", error);
        return buildFallbackExplanation(risk, research);
    }
}

function buildFallbackExplanation(risk: RiskOutput, research: ResearchOutput): string {
    if (risk.collateralAssets.length === 0 && risk.debtAssets.length === 0) {
        return "No active position found for this wallet yet. Once you supply collateral or borrow, Buoy will start monitoring your risk.";
    }
    const hfText = risk.healthFactor === null ? "no active debt" : `a Health Factor of ${risk.healthFactor.toFixed(2)}`;
    return `Your position currently has ${hfText}, putting it in the ${risk.riskLevel} risk category. ${research.marketNote}`;
}

function buildActionRationale(execution: ExecutionOutput, risk: RiskOutput): string {
  if (execution.recommendedAction === "NONE") {
    const hasPosition = risk.collateralAssets.length > 0 || risk.debtAssets.length > 0;
    return hasPosition
      ? "Your position is currently within a safe margin — no action needed right now."
      : "No active position detected yet.";
  }
  if (execution.recommendedAction === "REPAY") {
    return `Repaying $${execution.targetAmountUSD} of ${execution.targetAsset} would restore your Health Factor to a safer margin.`;
  }
  return `Supplying an additional $${execution.targetAmountUSD} of ${execution.targetAsset} would improve your safety margin.`;
}