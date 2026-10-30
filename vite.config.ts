import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// Docker dev (docker-compose.dev.yml): the API runs in another container, and VITE_PROXY_TARGET points to it.
const apiTarget = process.env.VITE_PROXY_TARGET ?? 'http://localhost:4000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],
  // During development the server's (server/) API and the uploaded media run on port 4000.
  server: {
    proxy: {
      '/api': apiTarget,
      '/uploads': apiTarget,
      '/media': apiTarget,
    },
  },
})
