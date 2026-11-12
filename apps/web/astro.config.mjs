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
  vite: {
    envDir: "../../",
    plugins: [tailwindcss()],
  },
  server: {
    port: 4321,
    host: true,
  },
});
