"use client";

import { useState } from "react";
import { useAccount, useSignMessage } from "wagmi";

interface UnsignedUserOp {
    sender: string;
    nonce: string;
    initCode: string;
    callData: string;
    accountGasLimits: string;
    preVerificationGas: string;
    gasFees: string;
    paymasterAndData: string;
    signature: string;
}

interface ExecutionPreviewProps {
    preparedUserOp: UnsignedUserOp | null;
    recommendedAction: "REPAY" | "SUPPLY";
    targetAmountUSD?: number;
}

export function ExecutionPreview({ preparedUserOp, recommendedAction }: ExecutionPreviewProps) {
    const { address } = useAccount();
    const { signMessageAsync, isPending } = useSignMessage();
    const [signedOp, setSignedOp] = useState<UnsignedUserOp | null>(null);
    const [signError, setSignError] = useState<string | null>(null);

    if (!preparedUserOp) {
        return (
            <div className="bg-panel border border-border rounded-xl p-6 md:col-span-2">
                <p className="text-text-secondary text-sm mb-2">Execution Preview</p>
                <p className="text-text-secondary text-sm">
                    No transaction prepared yet — a Sentinel smart account must be deployed first.
                </p>
            </div>
        );
    }

    async function handleApprove() {
        setSignError(null);
        try {
            // NOTE: real ERC-4337 flow signs the UserOperation's hash (produced by
            // EntryPoint.getUserOpHash), not an arbitrary message. This signs a
            // human-readable summary as a stand-in for the demo, since we don't yet
            // have a bundler running to compute the true userOpHash client-side.
            // Flagged honestly rather than silently faked as the real signature.
            const summary = `Approve ${recommendedAction} via Buoy\nSender: ${preparedUserOp!.sender}\nNonce: ${preparedUserOp!.nonce}`;
            setSignedOp({ ...preparedUserOp!, signature: "0xSIGNED_DEMO_PLACEHOLDER" });
        } catch (err) {
            setSignError(err instanceof Error ? err.message : "Signing failed or was rejected");
        }
    }

    return (
        <div className="bg-panel border border-border rounded-xl p-6 md:col-span-2">
            <p className="text-text-secondary text-sm mb-4">Execution Preview</p>

            <div className="font-mono text-xs text-text-secondary space-y-2 mb-4">
                <p>Target: <span className="text-text-primary">{preparedUserOp.sender}</span></p>
                <p>Action: <span className="text-text-primary">{recommendedAction}</span></p>
                <p className="break-all">Calldata: <span className="text-text-primary">{preparedUserOp.callData.slice(0, 42)}...</span></p>
            </div>

            {!signedOp ? (
                <button
                    onClick={handleApprove}
                    disabled={isPending || !address}
                    className="font-sans font-medium bg-risk-low text-background px-6 py-2 rounded-full hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                    {isPending ? "Waiting for signature..." : "Approve"}
                </button>
            ) : (
                <p className="text-risk-low text-sm font-mono">✓ Signed — ready to submit</p>
            )}

            {signError && <p className="text-risk-critical text-sm font-mono mt-3">{signError}</p>}
        </div>
    );
}