import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

/**
 * Validates and types all environment variables the backend depends on.
 * Fails fast at boot if anything required is missing or malformed, rather
 * than surfacing a confusing error deep inside a service later.
 */
const envSchema = z.object({
    PORT: z.coerce.number().default(4000),
    XLAYER_TESTNET_RPC: z.string().url(),
    MOCK_AAVE_POOL_ADDRESS: z.string().optional(),
    SENTINEL_ACCOUNT_FACTORY_ADDRESS: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    GEMINI_API_KEY: z.string().optional(),
    DATABASE_URL: z.string(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors);
    process.exit(1);
}

export const env = parsed.data;