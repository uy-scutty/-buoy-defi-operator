import { Request, Response } from "express";
import { z } from "zod";
import { runSupervisor } from "../services/agents/supervisor.service";
import { userRepository } from "../repositories/user.repository";
import { analysisRepository } from "../repositories/analysis.repository";

const analysisRequestSchema = z.object({
    walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
});

export async function createAnalysis(req: Request, res: Response) {
    const parseResult = analysisRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid request", details: parseResult.error.flatten() });
    }

    const { walletAddress } = parseResult.data;

    try {
        const user = await userRepository.findOrCreate(walletAddress);
        const result = await runSupervisor(walletAddress, user.smartAccount ?? null);

        const analysis = await analysisRepository.create({
            userId: user.id,
            totalCollateral: result.risk.totalCollateralUSD,
            totalDebt: result.risk.totalDebtUSD,
            healthFactor: result.risk.healthFactor ?? -1,
            loanToValue: result.risk.ltvPct,
            liquidationThreshold: result.risk.liquidationThresholdPct,
            riskSummary: JSON.stringify(result.risk),
            researchSummary: JSON.stringify(result.research),
            explanation: result.explanation,
            recommendedAction: result.recommendedAction,
            actionRationale: result.actionRationale,
            preparedUserOp: JSON.stringify(result.execution.preparedUserOp),
        });

        return res.status(201).json({
            analysisId: analysis.id,
            position: result.risk,
            research: result.research,
            explanation: result.explanation,
            recommendedAction: result.recommendedAction,
            actionRationale: result.actionRationale,
            preparedUserOp: result.execution.preparedUserOp,
        });
    } catch (error) {
        console.error("Analysis pipeline failed:", error);
        return res.status(500).json({ error: "Analysis failed", message: (error as Error).message });
    }
}

export async function getAnalysis(req: Request, res: Response) {
    const id = req.params.id as string;
    const analysis = await analysisRepository.findById(id);
    if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
    }
    return res.status(200).json(analysis);
}