import { Request, Response } from "express";
import { z } from "zod";
import { userRepository } from "../repositories/user.repository";

const walletAddressSchema = z.object({
    walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
});

const updateSettingsSchema = walletAddressSchema.extend({
    automationEnabled: z.boolean().optional(),
    healthFactorThreshold: z.number().min(1.0).max(10.0).optional(),
});

export async function getSettings(req: Request, res: Response) {
    const parseResult = walletAddressSchema.safeParse(req.query);
    if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid request", details: parseResult.error.flatten() });
    }

    const user = await userRepository.findOrCreate(parseResult.data.walletAddress);

    return res.status(200).json({
        automationEnabled: user.automationEnabled,
        healthFactorThreshold: user.healthFactorThreshold,
    });
}

export async function updateSettings(req: Request, res: Response) {
    const parseResult = updateSettingsSchema.safeParse(req.body);
    if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid request", details: parseResult.error.flatten() });
    }

    const { walletAddress, automationEnabled, healthFactorThreshold } = parseResult.data;

    const user = await userRepository.findOrCreate(walletAddress);
    const updated = await userRepository.updateSettings(user.id, { automationEnabled, healthFactorThreshold });

    return res.status(200).json({
        automationEnabled: updated.automationEnabled,
        healthFactorThreshold: updated.healthFactorThreshold,
    });
}