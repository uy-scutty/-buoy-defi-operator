import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { analysisRoutes } from "./routes/analysis.routes";
import { walletRoutes } from "./routes/wallet.routes";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "sentinel-api" });
});

app.use("/api", analysisRoutes);
app.use("/api", walletRoutes);

app.use(errorHandler);

app.listen(env.PORT, () => {
    console.log(`✅ Sentinel API listening on http://localhost:${env.PORT}`);
});