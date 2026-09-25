import { type Page, expect, test } from '@playwright/test'

// Die Tests bauen aufeinander auf: Die Datenbank wird nur einmal pro Lauf neu angelegt.
test.describe.configure({ mode: 'serial' })

const EMAIL = 'mama@example.org'
const PASSWORD = 'sehr-geheim-123'
const PIN = '1234'

/** Tippt auf das Label eines (optisch versteckten) Auswahlfelds, wie ein Mensch es tun würde. */
async function choose(page: Page, role: 'radio' | 'checkbox', name: string | RegExp) {
  const input = page.getByRole(role, { name })
  await page.locator('label').filter({ has: input }).click()
  await expect(input).toBeChecked()
}

async function enterPin(page: Page, pin: string) {
  for (const digit of pin) await page.getByRole('button', { name: digit, exact: true }).click()
  await page.getByRole('button', { name: 'Bestätigen' }).click()
}

test('Erster Meilenstein: Setup → Kind → Aufgabe → antippen → rückgängig', async ({ page }) => {
  // Setup und Admin
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Willkommen bei FamQuest' })).toBeVisible()
  await page.getByLabel('Familienname').fill('Familie Sonnenschein')
  await page.getByLabel('E-Mail').fill(EMAIL)
  await page.getByLabel('Passwort').fill(PASSWORD)
  await page.getByRole('button', { name: 'Weiter' }).click()
  await enterPin(page, PIN)
  await enterPin(page, PIN)

  // Noch keine Personen: Die Familienansicht verweist auf den Elternbereich.
  await expect(page.getByRole('heading', { name: 'Familie Sonnenschein' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Noch keine Familienmitglieder' })).toBeVisible()

  // Kind anlegen (Elternbereich über das Zahnrad, mit PIN)
  await page
    .getByRole('navigation', { name: 'Hauptnavigation' })
    .getByRole('link', { name: 'Einstellungen' })
    .click()
  await enterPin(page, PIN)
  await page.getByRole('button', { name: 'Person hinzufügen' }).click()
  await page.getByLabel('Name').fill('Lena')
  await choose(page, 'radio', 'Kind')
  await choose(page, 'radio', 'Lila')
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByRole('status')).toHaveText('Lena ist gespeichert.')

  // Aufgabe anlegen: täglich, morgens, 2 Punkte
  await page.getByRole('button', { name: 'Aufgabe hinzufügen' }).click()
  await page.getByLabel('Titel').fill('Zähne putzen')
  await choose(page, 'checkbox', /Lena/)
  await choose(page, 'radio', 'Morgens')
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByRole('status')).toHaveText('„Zähne putzen“ ist gespeichert.')

  // Zurück zur Familienansicht
  await page.getByRole('button', { name: 'Zur Familienansicht' }).click()
  const column = page.getByRole('region', { name: 'Aufgaben von Lena' })
  await expect(column.getByRole('link', { name: 'Lena öffnen' })).toBeVisible()
  const card = column.getByRole('button', { name: /^Zähne putzen/ })
  await expect(card).toHaveAttribute('aria-pressed', 'false')

  // Antippen erledigt, erneutes Tippen macht rückgängig – auch nach Neuladen gespeichert.
  await card.tap()
  await expect(card).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  // Alles erledigt: Der Abschnitt ist zugeklappt und lässt sich wieder aufklappen.
  await column.getByRole('button', { name: 'Morgens: alles erledigt' }).tap()
  await expect(card).toHaveAttribute('aria-pressed', 'true')

  await card.tap()
  await expect(card).toHaveAttribute('aria-pressed', 'false')
  await page.reload()
  await expect(card).toHaveAttribute('aria-pressed', 'false')
})

test('Personenansicht über den Avatar, auch am Smartphone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/login')
  await page.getByLabel('E-Mail').fill(EMAIL)
  await page.getByLabel('Passwort').fill(PASSWORD)
  await page.getByRole('button', { name: 'Anmelden' }).click()

  // Am Smartphone: Avatar-Leiste oben, eine Person pro Seite.
  await expect(page.getByRole('group', { name: 'Person wählen' })).toBeVisible()
  await page.getByRole('link', { name: 'Lena öffnen' }).tap()

  await expect(page.getByRole('heading', { name: 'Lena', level: 1 })).toBeVisible()
  const card = page.getByRole('button', { name: /^Zähne putzen/ })
  await card.tap()
  await expect(card).toHaveAttribute('aria-pressed', 'true')

  await page.getByRole('link', { name: 'Zurück zur Familienansicht' }).tap()
  await expect(
    page.getByRole('region', { name: 'Aufgaben von Lena' }).getByRole('button', {
      name: /Morgens/,
    }),
  ).toBeVisible()
})
