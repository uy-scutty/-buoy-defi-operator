import { Router } from "express";
import { createAnalysis, getAnalysis } from "../controllers/analysis.controller";

export const analysisRoutes = Router();

analysisRoutes.post("/analysis", createAnalysis);
analysisRoutes.get("/analysis/:id", getAnalysis);