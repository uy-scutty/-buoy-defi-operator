import { ethers } from "ethers";
import { env } from "./env";

/**
 * Shared read-only JSON-RPC provider for X Layer testnet. Services that
 * need to read on-chain state (e.g. positionService) import this rather
 * than creating their own provider instance.
 */
export const provider = new ethers.JsonRpcProvider(env.XLAYER_TESTNET_RPC);