import { prisma } from "../config/prisma";

export const userRepository = {
    findByWalletAddress(walletAddress: string) {
        return prisma.user.findUnique({ where: { walletAddress } });
    },

    create(walletAddress: string) {
        return prisma.user.create({ data: { walletAddress } });
    },

    findOrCreate(walletAddress: string) {
        return prisma.user.upsert({
            where: { walletAddress },
            update: {},
            create: { walletAddress },
        });
    },

    setSmartAccount(userId: string, smartAccount: string) {
        return prisma.user.update({
            where: { id: userId },
            data: { smartAccount },
        });
    },
};