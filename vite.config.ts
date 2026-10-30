import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// Docker dev (docker-compose.dev.yml): az API másik konténerben van, a VITE_PROXY_TARGET mutat rá.
const apiTarget = process.env.VITE_PROXY_TARGET ?? 'http://localhost:4000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],
  // A szerver (server/) API-ja és a feltöltött média fejlesztés közben a 4000-es porton fut.
  server: {
    proxy: {
      '/api': apiTarget,
      '/uploads': apiTarget,
      '/media': apiTarget,
    },
  },
})
