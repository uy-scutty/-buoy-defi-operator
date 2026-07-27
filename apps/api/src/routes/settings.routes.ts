import { Router } from "express";
import { getSettings, updateSettings } from "../controllers/settings.controller";

export const settingsRoutes = Router();

settingsRoutes.get("/settings", getSettings);
settingsRoutes.put("/settings", updateSettings);