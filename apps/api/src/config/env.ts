import path from "node:path";
import { config } from "dotenv";
import { z } from "zod";

config({ path: path.resolve(process.cwd(), "../../.env") });
config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  CORS_ORIGIN: z.string().url().default("http://localhost:5173"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  UPLOAD_DIR: z.string().default("./uploads"),
  WEB_DIST_DIR: z.string().optional(),
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(12),
  AI_PROVIDER: z.enum(["mock", "openai"]).default("mock"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_IMAGE_MODEL: z.string().default("gpt-image-1")
});

export const env = envSchema.parse(process.env);
export const isProduction = env.NODE_ENV === "production";
