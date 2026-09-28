import { defineConfig, devices } from '@playwright/test'

/**
 * Moment, in dem die Screenshots spielen: Donnerstag der laufenden Woche (Wochenansichten zeigen
 * Erledigtes und Kommendes), morgens um 7:25 mit laufender Morgenroutine.
 */
export const DEMO_WEEKDAY = 4
export const DEMO_TIME = '07:25'

const LANGUAGES = [
  { language: 'de', locale: 'de-DE', port: 8011 },
  { language: 'en', locale: 'en-GB', port: 8012 },
]

/**
 * Screenshots für die READMEs mit Demodaten (backend/app/demo.py), je Sprache eine App.
 * Voraussetzung: PostgreSQL läuft lokal (docker compose up -d db). Start: npm run screenshots
 */
export default defineConfig({
  testDir: '.',
  testMatch: 'screenshots.spec.ts',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  timeout: 60_000,
  use: {
    timezoneId: 'Europe/Berlin',
    ...devices['Desktop Chrome'],
    hasTouch: true,
  },
  projects: LANGUAGES.map(({ language, locale, port }) => ({
    name: language,
    use: { baseURL: `http://127.0.0.1:${port}`, locale },
  })),
  webServer: LANGUAGES.map(({ language, port }) => ({
    command: `bash server.sh ${language} ${port} ${DEMO_WEEKDAY} ${DEMO_TIME}`,
    url: `http://127.0.0.1:${port}/api/health`,
    reuseExistingServer: false,
    timeout: 180_000,
  })),
})
