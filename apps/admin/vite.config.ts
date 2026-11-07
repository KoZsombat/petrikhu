import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

/** In development the admin runs on :5173 and talks to the public site's port (Next.js), which proxies the API. */
const site = process.env.VITE_SITE_URL ?? 'http://localhost:4000'

export default defineConfig({
  base: '/admin/',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { '/api': site, '/uploads': site, '/media': site, '/elonezet': site, '/_next': site },
  },
  build: { outDir: 'dist', chunkSizeWarningLimit: 900 },
})
