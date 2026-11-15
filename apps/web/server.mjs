/**
 * Node entry for the public site.
 *
 * Astro's standalone server does not add response headers to prerendered pages (they are served by
 * the static handler, before middleware), so the adapter's handler is wrapped in a server that sets
 * the baseline security headers on every response, static or server-rendered. CSP is emitted by
 * Astro itself (`security.csp` in astro.config.mjs), with hashes for the inlined scripts.
 *
 * Start with ASTRO_NODE_AUTOSTART=disabled so importing the entry does not also start its server.
 */
import { createServer } from "node:http";
import { handler } from "./dist/server/entry.mjs";

const HOST = process.env.HOST ?? "0.0.0.0";
const PORT = Number(process.env.PORT ?? 4321);

const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-frame-options": "DENY",
  "permissions-policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "cross-origin-opener-policy": "same-origin",
  "strict-transport-security": "max-age=31536000",
};

const server = createServer((request, response) => {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    response.setHeader(name, value);
  }

  handler(request, response, () => {
    response.statusCode = 404;
    response.setHeader("content-type", "text/html; charset=utf-8");
    response.end("<!doctype html><title>404</title><h1>Az oldal nem található</h1>");
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Web listening on http://${HOST}:${PORT}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
