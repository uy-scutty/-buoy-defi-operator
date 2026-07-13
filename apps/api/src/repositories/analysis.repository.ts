import { prisma } from "../config/prisma";

export const analysisRepository = {
    create(data: {
        userId: string;
        totalCollateral: number;
        totalDebt: number;
        healthFactor: number;
        loanToValue: number;
        liquidationThreshold: number;
        riskSummary: string;
        researchSummary: string;
        explanation: string;
        recommendedAction: string;
        actionRationale: string;
        preparedUserOp: string;
    }) {
        return prisma.analysis.create({ data });
    },

    findById(id: string) {
        return prisma.analysis.findUnique({ where: { id } });
    },

    findLatestForUser(userId: string) {
        return prisma.analysis.findFirst({
            where: { userId },
            orderBy: { createdAt: "desc" },
        });
    },

    updateStatus(id: string, status: string, txHash?: string) {
        return prisma.analysis.update({
            where: { id },
            data: { status, ...(txHash ? { txHash } : {}) },
        });
    },
};