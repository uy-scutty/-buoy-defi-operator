import { Router } from "express";
import { connectWallet, getDeployAccountInfo } from "../controllers/wallet.controller";

export const walletRoutes = Router();

walletRoutes.post("/wallet/connect", connectWallet);
walletRoutes.post("/wallet/deploy-account", getDeployAccountInfo);