/**
 * End-to-end smoke tests against the real stack: the API on :4001 (a fresh E2E database) and the built
 * Next.js site on :4000, which also serves the built admin at /admin. Build first: `bun run build`.
 */
import { defineConfig, devices } from '@playwright/test'

const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? 'postgres://petrik:petrik@localhost:5432/petrik_e2e'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: { baseURL: 'http://localhost:4000', trace: 'off', locale: 'hu-HU', timezoneId: 'Europe/Budapest' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'bun e2e/reset-db.ts && bun apps/server/src/index.ts',
      url: 'http://localhost:4001/healthz',
      env: { DATABASE_URL: E2E_DATABASE_URL, PNW_API_PORT: '4001', NODE_ENV: 'test' },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'bun run --cwd apps/client start',
      url: 'http://localhost:4000/',
      env: { PNW_API_URL: 'http://localhost:4001' },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
})
