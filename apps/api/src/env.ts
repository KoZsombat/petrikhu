import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .default("postgres://app:app@localhost:5432/app"),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url().default("http://localhost:3001"),
  PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGINS: z
    .string()
    .default(
      "http://localhost:5173,http://localhost:3002,http://localhost:3003",
    ),
  ADMIN_EMAIL: z.email().default("admin@petrik.hu"),
  ADMIN_PASSWORD: z.string().min(8).default("PetrikAdmin2026!"),
  ADMIN_RESET_PASSWORD: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "Invalid environment variables:\n",
    z.prettifyError(parsed.error),
  );
  process.exit(1);
}

export const env = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
};
