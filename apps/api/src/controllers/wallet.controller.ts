import { Request, Response } from "express";
import { z } from "zod";
import { userRepository } from "../repositories/user.repository";
import { getOrPredictSmartAccount } from "../services/wallet.service";

const walletAddressSchema = z.object({
    walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
});

export async function connectWallet(req: Request, res: Response) {
    const parseResult = walletAddressSchema.safeParse(req.body);
    if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid request", details: parseResult.error.flatten() });
    }

    const user = await userRepository.findOrCreate(parseResult.data.walletAddress);
    return res.status(200).json({ userId: user.id, smartAccount: user.smartAccount });
}

export async function getDeployAccountInfo(req: Request, res: Response) {
    const parseResult = walletAddressSchema.safeParse(req.body);
    if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid request", details: parseResult.error.flatten() });
    }

    const { walletAddress } = parseResult.data;

    try {
        const info = await getOrPredictSmartAccount(walletAddress);

        // If already deployed on-chain, persist it so future requests don't
        // need to re-derive it, and the Execution Agent can use it immediately.
        if (info.alreadyDeployed) {
            const user = await userRepository.findOrCreate(walletAddress);
            await userRepository.setSmartAccount(user.id, info.predictedAddress);
        }

        return res.status(200).json({
            factoryAddress: info.factoryAddress,
            factoryCallData: info.factoryCallData,
            predictedAddress: info.predictedAddress,
            alreadyDeployed: info.alreadyDeployed,
        });
    } catch (error) {
        console.error("Deploy-account info failed:", error);
        return res.status(500).json({ error: "Failed to compute smart account", message: (error as Error).message });
    }
}