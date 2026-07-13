import { PrismaClient } from "@prisma/client";

/**
 * Single shared PrismaClient instance across the app. Repositories import
 * this rather than instantiating their own client, avoiding connection
 * exhaustion during ts-node-dev hot reloads.
 */
export const prisma = new PrismaClient();