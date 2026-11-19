import { makeSignature } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { auth } from "../auth";
import { db } from "../db";
import { session } from "../db/auth-schema";

/**
 * Temporary auth-cookie probe: reports the cookie NAMES on the request (never values),
 * whether the signed token verifies, and whether its session row exists.
 */
export const registerDiagRoutes = (app: Hono) => {
  app.get("/api/diag/cookies", async (c) => {
    const raw = c.req.header("cookie") ?? "";
    const cookies = new Map(
      raw
        .split(";")
        .map((part) => part.trim().split("="))
        .filter((entry) => Boolean(entry[0]))
        .map(([name, ...value]) => [name, value.join("=")]),
    );
    const names = [...cookies.keys()];
    const signed =
      cookies.get("__Secure-better-auth.session_token") ??
      cookies.get("better-auth.session_token") ??
      null;

    let signatureValid: boolean | null = null;
    let sessionRowFound: boolean | null = null;
    let sessionExpired: boolean | null = null;
    let sessionExpiresAt: string | null = null;
    let sessionCreatedAt: string | null = null;
    if (signed) {
      const decoded = (() => {
        try {
          return decodeURIComponent(signed);
        } catch {
          return signed;
        }
      })();
      const splitAt = decoded.lastIndexOf(".");
      if (splitAt > 0) {
        const token = decoded.slice(0, splitAt);
        const signature = decoded.slice(splitAt + 1);
        const context = await auth.$context;
        signatureValid = signature === (await makeSignature(token, context.secret));
        const row = await db.query.session.findFirst({
          where: eq(session.token, token),
          columns: { id: true, expiresAt: true, createdAt: true },
        });
        sessionRowFound = Boolean(row);
        if (row) {
          sessionExpired = row.expiresAt.getTime() < Date.now();
          sessionExpiresAt = row.expiresAt.toISOString();
          sessionCreatedAt = row.createdAt.toISOString();
        }
      }
    }

    let sessionResolved = false;
    try {
      sessionResolved = Boolean(
        await auth.api.getSession({ headers: c.req.raw.headers }),
      );
    } catch {
      sessionResolved = false;
    }

    return c.json({
      cookieNames: names,
      hasSessionToken: names.includes("__Secure-better-auth.session_token") ||
        names.includes("better-auth.session_token"),
      signatureValid,
      sessionRowFound,
      sessionExpired,
      sessionExpiresAt,
      sessionCreatedAt,
      now: new Date().toISOString(),
      sessionResolved,
      forwardedProto: c.req.header("x-forwarded-proto") ?? null,
      host: c.req.header("host") ?? null,
    });
  });
};
