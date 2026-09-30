import { z } from "zod";

const flag = z
  .enum(["0", "1", "true", "false"])
  .default("1")
  .transform((v) => v === "1" || v === "true");

const schema = z.object({
  DATABASE_URL: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v.trim() : undefined)),
  DATA_DIR: z.string().default("data/pglite"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default("0.0.0.0"),
  FRONTEND_DIR: z.string().default("../frontend/dist"),
  SCHEDULER_ENABLED: flag,
  SCHEDULER_TICK_SECONDS: z.coerce.number().int().min(10).default(300),
  USER_AGENT: z.string().default("UniversitiesScraper/0.1 (internal research tool)"),
  HTTP_MIN_DELAY_MS: z.coerce.number().int().min(0).default(2000),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const result = schema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`invalid configuration: ${problems}`);
  }
  return result.data;
}
