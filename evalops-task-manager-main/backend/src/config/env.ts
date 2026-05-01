import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();
dotenv.config({ path: "../.env" });

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(24, "JWT_SECRET must be at least 24 characters"),
  PORT: z.coerce.number().default(8080),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development")
});

export const env = envSchema.parse(process.env);
