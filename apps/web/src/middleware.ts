import { defineMiddleware } from "astro:middleware";

/**
 * The public site and the API share one origin: everything under `/api/*` is proxied to the API
 * container. That keeps media URLs, auth cookies and the admin app on a single hostname, and avoids
 * CORS between the site and its data.
 */
const API_ORIGIN = (
  process.env.API_INTERNAL_URL ?? "http://localhost:3001"
).replace(/\/+$/, "");

/** Hop-by-hop headers and values the upstream fetch must recompute. */
const REQUEST_SKIP = new Set([
  "host",
  "connection",
  "content-length",
  "accept-encoding",
  "transfer-encoding",
  "keep-alive",
  "upgrade",
  "te",
  "trailer",
  "proxy-authorization",
  "proxy-authenticate",
]);

/** Same for the response: `fetch` already decoded the body, so its framing headers are stale. */
const RESPONSE_SKIP = new Set([
  "connection",
  "content-length",
  "content-encoding",
  "transfer-encoding",
  "keep-alive",
  "upgrade",
  "te",
  "trailer",
]);

export const onRequest = defineMiddleware(async (context, next) => {
  if (!context.url.pathname.startsWith("/api/")) return next();

  const { request } = context;
  const headers = new Headers(request.headers);
  for (const name of REQUEST_SKIP) headers.delete(name);

  const hasBody = request.method !== "GET" && request.method !== "HEAD";

  const upstream = await fetch(
    `${API_ORIGIN}${context.url.pathname}${context.url.search}`,
    {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      redirect: "manual",
      // Streaming request bodies through undici require this flag.
      duplex: "half",
    } as RequestInit,
  );

  const responseHeaders = new Headers();
  for (const [name, value] of upstream.headers) {
    if (!RESPONSE_SKIP.has(name) && name !== "set-cookie") {
      responseHeaders.set(name, value);
    }
  }

  // A login response can set several cookies; `Headers.set` would collapse them into one.
  for (const cookie of upstream.headers.getSetCookie()) {
    responseHeaders.append("set-cookie", cookie);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
});
