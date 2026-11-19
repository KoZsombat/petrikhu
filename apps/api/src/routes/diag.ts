import { Hono } from "hono";

/**
 * Temporary auth-cookie probe: reports the cookie NAMES on the request (never values)
 * so the admin login can show whether the session cookie reached the API at all.
 */
export const registerDiagRoutes = (app: Hono) => {
  app.get("/api/diag/cookies", (c) => {
    const raw = c.req.header("cookie") ?? "";
    const names = [
      ...new Set(
        raw
          .split(";")
          .map((part) => part.trim().split("=")[0])
          .filter((name): name is string => Boolean(name)),
      ),
    ];

    return c.json({
      cookieNames: names,
      hasSessionToken: names.includes("__Secure-better-auth.session_token") ||
        names.includes("better-auth.session_token"),
      forwardedProto: c.req.header("x-forwarded-proto") ?? null,
      host: c.req.header("host") ?? null,
    });
  });
};
