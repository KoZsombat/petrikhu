import node from "@astrojs/node";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL ?? "https://petrik.hu",
  trailingSlash: "never",
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [react()],
  /**
   * Content-Security-Policy with hashes for Astro's inlined scripts/styles. Stored post HTML is
   * sanitised by the API on write; this is the second line of defence for the rendered article.
   * YouTube is the only third-party frame; images may come from the API origin or the legacy site.
   */
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data: https:",
        "font-src 'self'",
        "connect-src 'self'",
        "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
      ],
      styleDirective: {
        resources: ["'self'", "'unsafe-inline'"],
      },
    },
  },
  vite: {
    envDir: "../../",
    plugins: [tailwindcss()],
  },
  server: {
    port: 4321,
    host: true,
  },
});
