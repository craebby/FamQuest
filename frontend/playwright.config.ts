import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.E2E_PORT ?? 8001)
const baseURL = `http://127.0.0.1:${port}`

/**
 * End-to-End-Tests der Familienansicht gegen die echte App (Backend + gebautes Frontend).
 * Voraussetzung: PostgreSQL läuft lokal (docker compose up -d db). Start: npm run e2e
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: {
    baseURL,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    trace: 'retain-on-failure',
  },
  projects: [
    // Hauptziel: Touchscreen im Querformat am Kühlschrank.
    {
      name: 'display',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: 'bash e2e/server.sh',
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { E2E_PORT: String(port) },
  },
})
