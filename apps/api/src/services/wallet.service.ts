import { ethers } from "ethers";
import { provider } from "../config/chain";
import { env } from "../config/env";
import factoryAbi from "../config/abi/SentinelAccountFactory.json";

export interface DeployAccountInfo {
    predictedAddress: string;
    factoryAddress: string;
    factoryCallData: string; // calldata for createAccount(owner, salt) — frontend can send this itself if it wants to deploy directly
    alreadyDeployed: boolean;
}

const DEFAULT_SALT = 0n;

/**
 * Computes a user's deterministic SentinelSmartAccount address and whether
 * it's already deployed. Does NOT deploy anything — matches the "backend
 * builds, never sends transactions on the user's behalf" boundary from the
 * ERC-4337 Integration Plan. The frontend can use factoryCallData to deploy
 * directly if it chooses to, independent of the analysis/execution flow.
 */
export async function getOrPredictSmartAccount(ownerAddress: string): Promise<DeployAccountInfo> {
    if (!env.SENTINEL_ACCOUNT_FACTORY_ADDRESS) {
        throw new Error("SENTINEL_ACCOUNT_FACTORY_ADDRESS is not configured — deploy contracts first");
    }

    const factory = new ethers.Contract(env.SENTINEL_ACCOUNT_FACTORY_ADDRESS, factoryAbi as any, provider);
    const predictedAddress: string = await factory.getFunction("getAddress")(ownerAddress, DEFAULT_SALT);
    const code = await provider.getCode(predictedAddress);
    const alreadyDeployed = code !== "0x";

    const factoryInterface = new ethers.Interface(factoryAbi as any);
    const factoryCallData = factoryInterface.encodeFunctionData("createAccount", [ownerAddress, DEFAULT_SALT]);

    return {
        predictedAddress,
        factoryAddress: env.SENTINEL_ACCOUNT_FACTORY_ADDRESS,
        factoryCallData,
        alreadyDeployed,
    };
}
