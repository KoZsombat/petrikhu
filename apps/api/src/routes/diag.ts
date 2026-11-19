import { Hono } from "hono";
import { auth } from "../auth";

/**
 * Temporary auth-cookie probe: reports the cookie NAMES on the request (never values)
 * and whether better-auth resolves a session from them.
 */
export const registerDiagRoutes = (app: Hono) => {
  app.get("/api/diag/cookies", async (c) => {
    const raw = c.req.header("cookie") ?? "";
    const names = [
      ...new Set(
        raw
          .split(";")
          .map((part) => part.trim().split("=")[0])
          .filter((name): name is string => Boolean(name)),
      ),
    ];

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
      sessionResolved,
      forwardedProto: c.req.header("x-forwarded-proto") ?? null,
      host: c.req.header("host") ?? null,
    });
  });
};
