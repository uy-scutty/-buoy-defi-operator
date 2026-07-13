import { prisma } from "../config/prisma";

export const agentRepository = {
    findAll() {
        return prisma.agent.findMany();
    },

    create(data: {
        name: string;
        description: string;
        walletAddress?: string;
        capabilities: string; // JSON-encoded string
        metadata: string;     // JSON-encoded string
    }) {
        return prisma.agent.create({ data });
    },
};