import { z } from "zod";

/** Values shipped in `.env.example` and the dev compose file; never valid in production. */
const INSECURE_SECRET = "dev-only-secret-change-me-0123456789abcdef";
const INSECURE_PASSWORD = "PetrikAdmin2026!";

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
  ADMIN_PASSWORD: z.string().min(8).default(INSECURE_PASSWORD),
  ADMIN_RESET_PASSWORD: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  /**
   * Trust `cf-connecting-ip` / `x-forwarded-for` for rate limiting. Enable only when the API is
   * reachable exclusively through the reverse proxy (Traefik/Cloudflare).
   */
  TRUST_PROXY: z
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

if (process.env.NODE_ENV === "production") {
  const problems: string[] = [];

  if (parsed.data.BETTER_AUTH_SECRET === INSECURE_SECRET) {
    problems.push(
      "BETTER_AUTH_SECRET is the development default. Set a random value (openssl rand -base64 32).",
    );
  }

  if (parsed.data.ADMIN_PASSWORD === INSECURE_PASSWORD) {
    problems.push(
      "ADMIN_PASSWORD is the development default. Set a unique password (or change it in the admin UI afterwards).",
    );
  }

  if (problems.length > 0) {
    console.error(
      `Refusing to start in production:\n${problems.map((line) => `- ${line}`).join("\n")}`,
    );
    process.exit(1);
  }
}

export const env = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
};
