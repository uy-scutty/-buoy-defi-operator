import { ethers } from "ethers";
import { provider } from "../config/chain";

const ENTRY_POINT_ADDRESS = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
const ENTRY_POINT_ABI = ["function getNonce(address sender, uint192 key) view returns (uint256)"];

export interface UnsignedUserOperation {
    sender: string;
    nonce: string;
    initCode: string;
    callData: string;
    accountGasLimits: string;
    preVerificationGas: string;
    gasFees: string;
    paymasterAndData: string;
    signature: string; // always "0x" — this object is NEVER signed server-side
}

/**
 * Builds an UNSIGNED PackedUserOperation. The backend never holds a private
 * key and never signs anything — this object is returned to the frontend,
 * which signs it with the user's connected wallet before submitting to the
 * bundler directly (see ERC-4337 Integration Plan: backend builds, client
 * signs and submits).
 */
export async function buildUnsignedUserOp(
    smartAccountAddress: string,
    callData: string
): Promise<UnsignedUserOperation> {
    const entryPoint = new ethers.Contract(ENTRY_POINT_ADDRESS, ENTRY_POINT_ABI, provider);
    const nonce: bigint = await entryPoint.getNonce(smartAccountAddress, 0);

    // Placeholder gas values — a production bundler flow would call
    // eth_estimateUserOperationGas first. Fixed generous defaults are
    // acceptable for a demo where we control the exact transaction being run.
    const verificationGasLimit = 500_000n;
    const callGasLimit = 500_000n;
    const maxPriorityFeePerGas = ethers.parseUnits("1", "gwei");
    const maxFeePerGas = ethers.parseUnits("1", "gwei");

    const accountGasLimits = ethers.solidityPacked(
        ["uint128", "uint128"],
        [verificationGasLimit, callGasLimit]
    );
    const gasFees = ethers.solidityPacked(
        ["uint128", "uint128"],
        [maxPriorityFeePerGas, maxFeePerGas]
    );

    return {
        sender: smartAccountAddress,
        nonce: nonce.toString(),
        initCode: "0x",
        callData,
        accountGasLimits,
        preVerificationGas: "100000",
        gasFees,
        paymasterAndData: "0x",
        signature: "0x",
    };
}
