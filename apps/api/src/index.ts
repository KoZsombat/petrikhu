import { swaggerUI } from "@hono/swagger-ui";
import { cors } from "hono/cors";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { getConnInfo } from "hono/bun";
import { rateLimiter } from "hono-rate-limiter";
import { auth } from "./auth";
import { env } from "./env";
import { openApiDocument } from "./openapi";
import { registerDocumentRoutes } from "./routes/documents";
import { registerMediaRoutes } from "./routes/media";
import { registerPostCategoryRoutes } from "./routes/post-categories";
import { registerPostRoutes } from "./routes/posts";
import { registerTeacherRoutes } from "./routes/teachers";
import { registerUserRoutes } from "./routes/users";

const app = new Hono();

app.use(logger());

/* Helmet-equivalent hardening for Hono. CSP allows YouTube embeds. */
app.use(
  "*",
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
      connectSrc: ["'self'"],
      frameSrc: ["'self'", "https:"],
      frameAncestors: ["'none'"],
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: "cross-origin",
  }),
);

/* CORS: browser clients are the admin app (cookies) and the Astro site. */
app.use(
  "/*",
  cors({
    origin: env.corsOrigins,
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Reset"],
    maxAge: 86_400,
  }),
);

/* General API limit; stricter bucket for auth (better-auth also rate-limits internally). */
app.use(
  "/api/*",
  rateLimiter({
    windowMs: 60_000,
    limit: 300,
    standardHeaders: "draft-6",
    keyGenerator: (c) =>
      c.req.header("cf-connecting-ip") ??
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      getConnInfo(c).remote.address ??
      "unknown",
    message: { error: "Too many requests" },
  }),
);
app.use(
  "/api/auth/*",
  rateLimiter({
    windowMs: 60_000,
    limit: 30,
    standardHeaders: "draft-6",
    keyGenerator: (c) =>
      c.req.header("cf-connecting-ip") ??
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      getConnInfo(c).remote.address ??
      "unknown",
    message: { error: "Too many authentication attempts" },
  }),
);

/* Public registration is disabled: only an existing admin can create accounts. */
app.use("/api/auth/sign-up/email", async (c, next) => {
  if (c.req.method === "POST") {
    return c.json({ error: "Registration is disabled" }, 403);
  }
  await next();
});

app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

registerPostRoutes(app);
registerPostCategoryRoutes(app);
registerTeacherRoutes(app);
registerDocumentRoutes(app);
registerMediaRoutes(app);
registerUserRoutes(app);

app.get("/openapi.json", (c) => c.json(openApiDocument));

app.get("/docs", swaggerUI({ url: "/openapi.json" }));

app.get("/health", (c) => c.json({ ok: true }));

console.log(`API listening on http://localhost:${env.PORT}`);

export default { port: env.PORT, fetch: app.fetch };
