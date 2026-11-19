import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import * as schema from "./db/schema";
import { env } from "./env";

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: env.corsOrigins,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "inactive",
        input: false,
      },
    },
  },
  advanced: {
    /** Distinct from other apps on *.zsombor.dev, whose better-auth cookies can be sent here too. */
    cookiePrefix: "petrik",
    database: {
      generateId: () => crypto.randomUUID(),
    },
  },
});
