import { type Locator, type Page, expect, test } from '@playwright/test'

import { DEMO_TIME, DEMO_WEEKDAY } from './playwright.config'

// Zugang der Beispielfamilie (backend/app/demo.py).
const EMAIL = 'demo@famquest.example'
const PASSWORD = 'famquest-demo'
const PIN = '1234'

const DISPLAY = { width: 1920, height: 1080 }
const TABLET = { width: 1280, height: 800 }
const PHONE = { width: 390, height: 844 }

/** DEMO_WEEKDAY dieser Woche um DEMO_TIME in Berlin, passend zur Uhr des Servers. */
function demoInstant(): Date {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' })
  const noon = new Date(`${today}T12:00:00Z`)
  const isoWeekday = noon.getUTCDay() || 7
  noon.setUTCDate(noon.getUTCDate() + DEMO_WEEKDAY - isoWeekday)
  const date = noon.toISOString().slice(0, 10)
  const offset = new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Berlin',
    timeZoneName: 'longOffset',
  })
    .formatToParts(noon)
    .find((part) => part.type === 'timeZoneName')!
    .value.replace('GMT', '')
  return new Date(`${date}T${DEMO_TIME}:00${offset || '+00:00'}`)
}

/** Anmelden und den Elternbereich entsperren, ohne sprachabhängige Klicks. */
async function signIn(page: Page) {
  const login = await page.request.post('/api/auth/login', {
    data: { email: EMAIL, password: PASSWORD },
  })
  expect(login.ok()).toBe(true)
  const { csrf_token } = await login.json()
  const unlock = await page.request.post('/api/parent/unlock', {
    data: { pin: PIN },
    headers: { 'X-CSRF-Token': csrf_token },
  })
  expect(unlock.ok()).toBe(true)
}

async function memberId(page: Page, name: string): Promise<number> {
  const members: { id: number; name: string }[] = await (
    await page.request.get('/api/members')
  ).json()
  return members.find((member) => member.name === name)!.id
}

interface ShotOptions {
  /** Vor der Aufnahme, nach dem Laden (z. B. einen Dialog öffnen). */
  prepare?: () => Promise<void>
  /** Nur diesen Teil der Seite aufnehmen. */
  element?: () => Locator
  /** Fotos als JPEG, alles andere als PNG. */
  jpeg?: boolean
}

/** Seite öffnen, warten, bis alles geladen ist, und unter docs/screenshots/<sprache>/ sichern. */
async function shoot(
  page: Page,
  name: string,
  path: string,
  viewport: { width: number; height: number },
  { prepare, element, jpeg = false }: ShotOptions = {},
) {
  await page.setViewportSize(viewport)
  await page.goto(path)
  await page.waitForLoadState('networkidle')
  if (prepare) await prepare()
  // Bilder und Übergänge fertig werden lassen.
  await page.waitForTimeout(800)
  const file = `../docs/screenshots/${test.info().project.name}/${name}.${jpeg ? 'jpg' : 'png'}`
  const options = { path: file, animations: 'disabled' as const, ...(jpeg ? { quality: 80 } : {}) }
  await (element ? element().screenshot(options) : page.screenshot(options))
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: demoInstant() })
  await signIn(page)
})

test('Display', async ({ page }) => {
  await shoot(page, 'today', '/', DISPLAY)
  await shoot(page, 'tasks', '/tasks', DISPLAY)
  await shoot(page, 'tasks-week', '/tasks/week', DISPLAY)
  await shoot(page, 'calendar', '/calendar', DISPLAY)
  await shoot(page, 'calendar-event', '/calendar', DISPLAY, {
    prepare: async () => {
      await page.getByTestId('calendar-event').filter({ hasText: 'Judo' }).first().click()
      await expect(page.getByRole('dialog')).toBeVisible()
    },
  })
  await shoot(page, 'meals', '/meals', DISPLAY)
  await shoot(page, 'shopping', '/shopping', DISPLAY)
  await shoot(page, 'rewards', `/rewards/${await memberId(page, 'Mia')}`, DISPLAY)
  await shoot(page, 'frame', '/frame', DISPLAY, {
    jpeg: true,
    prepare: async () => {
      await expect(page.locator('img').first()).toBeVisible()
      await page.waitForFunction(() => [...document.images].every((image) => image.complete))
      await page.waitForTimeout(2000)
    },
  })
})

test('Elternbereich', async ({ page }) => {
  await shoot(page, 'parents-review', '/parents/review', TABLET)
  await shoot(page, 'parents-routines', '/parents/routines', TABLET)
  // Haushalt der Erwachsenen statt der Kinderroutinen, die unter „Routinen“ zu sehen sind.
  await shoot(page, 'parents-tasks', '/parents/tasks', TABLET, {
    prepare: () => page.getByText('Anna', { exact: true }).first().click(),
  })
  // Nur der Abschnitt: Ohne Google-Zugangsdaten stünde darüber ein Einrichtungshinweis.
  await shoot(page, 'parents-symbols', '/parents/connections', TABLET, {
    element: () => page.locator('section').filter({ has: page.getByTestId('event-symbol') }),
  })
})

test('Handy', async ({ page }) => {
  await shoot(page, 'phone-today', '/', PHONE)
  await shoot(page, 'phone-shopping', '/shopping', PHONE)
})
