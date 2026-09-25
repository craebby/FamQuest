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

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('E-Mail').fill(EMAIL)
  await page.getByLabel('Passwort').fill(PASSWORD)
  await page.getByRole('button', { name: 'Anmelden' }).click()
}

test('Erster Meilenstein: Setup → Kind → Aufgabe → antippen → Punkte → rückgängig', async ({
  page,
}) => {
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
  await page.getByRole('button', { name: 'Mehr Punkte' }).click()
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
  await expect(column.getByText('Insgesamt 0 Punkte')).toBeAttached()

  // Antippen erledigt und bucht Punkte, erneutes Tippen macht rückgängig –
  // auch nach Neuladen gespeichert.
  await card.tap()
  await expect(card).toHaveAttribute('aria-pressed', 'true')
  await expect(card.getByTestId('points-feedback')).toHaveText('+2')
  await page.reload()
  await expect(column.getByText('Insgesamt 2 Punkte')).toBeAttached()
  await expect(column.getByRole('img', { name: '1 von 1 Aufgaben erledigt' })).toBeVisible()
  // Alles erledigt: Der Abschnitt ist zugeklappt und lässt sich wieder aufklappen.
  await column.getByRole('button', { name: 'Morgens: alles erledigt' }).tap()
  await expect(card).toHaveAttribute('aria-pressed', 'true')

  await card.tap()
  await expect(card).toHaveAttribute('aria-pressed', 'false')
  await page.reload()
  await expect(card).toHaveAttribute('aria-pressed', 'false')
  await expect(column.getByText('Insgesamt 0 Punkte')).toBeAttached()
})

test('Personenansicht über den Avatar, auch am Smartphone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await login(page)

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

test('Eltern sehen die Buchungen und schreiben Punkte gut', async ({ page }) => {
  await login(page)
  await page
    .getByRole('navigation', { name: 'Hauptnavigation' })
    .getByRole('link', { name: 'Einstellungen' })
    .click()
  await enterPin(page, PIN)

  await page.getByRole('button', { name: 'Punkte von Lena' }).click()
  // Aus den vorigen Tests: erledigt, rückgängig, wieder erledigt.
  const rows = page.getByRole('listitem')
  await expect(rows).toHaveCount(3)
  await expect(rows.first()).toContainText('Aufgabe erledigt')
  await expect(rows.first()).toContainText('+2')

  await page.getByRole('button', { name: 'Mehr Punkte' }).click()
  await page.getByLabel('Begründung').fill('Beim Tischdecken geholfen')
  await page.getByRole('button', { name: '2 Punkte gutschreiben' }).click()
  await expect(page.getByRole('status')).toHaveText('Lena hat 2 Punkte bekommen.')
  await expect(rows.first()).toContainText('Beim Tischdecken geholfen')

  await page.getByRole('button', { name: 'Zurück' }).click()
  await page.getByRole('button', { name: 'Zur Familienansicht' }).click()
  await expect(
    page.getByRole('region', { name: 'Aufgaben von Lena' }).getByText('Insgesamt 4 Punkte'),
  ).toBeAttached()
})

test('Eltern wählen Belohnungen aus, das Kind löst am Display ein', async ({ page }) => {
  await login(page)
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
  await nav.getByRole('link', { name: 'Einstellungen' }).click()
  await enterPin(page, PIN)

  // Aus dem Pool zwei Belohnungen für Lena übernehmen, eine davon günstiger machen.
  await page.getByRole('button', { name: 'Aus Vorschlägen wählen' }).click()
  await choose(page, 'checkbox', /Eine kleine Süßigkeit/)
  await choose(page, 'checkbox', /Ein Eis/)
  await page.getByRole('button', { name: '2 Belohnungen hinzufügen' }).click()
  await expect(page.getByRole('status')).toHaveText('Lena hat 2 neue Belohnungen.')
  await page.getByRole('button', { name: 'Eine kleine Süßigkeit bearbeiten' }).click()
  await page.getByRole('button', { name: 'Weniger Punkte' }).click()
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByRole('status')).toHaveText('„Eine kleine Süßigkeit“ ist gespeichert.')
  await page.getByRole('button', { name: 'Zur Familienansicht' }).click()

  // Geschenk → Lena → Belohnung → bestätigen. Lena hat 4 Punkte.
  await nav.getByRole('link', { name: 'Belohnungen' }).tap()
  await page.getByRole('link', { name: 'Belohnungen von Lena' }).tap()
  await expect(page.getByText('Noch 6 Punkte nötig')).toBeVisible()
  await page.getByRole('button', { name: 'Eine kleine Süßigkeit einlösen' }).tap()
  await page.getByRole('button', { name: 'Ja, einlösen' }).tap()
  await expect(
    page.getByRole('heading', { name: 'Viel Spaß: Eine kleine Süßigkeit!' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Fertig' }).tap()
  await expect(page.getByText('Insgesamt 0 Punkte')).toBeAttached()
  await expect(page.getByText('Noch 10 Punkte nötig')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Eine kleine Süßigkeit einlösen' })).toBeHidden()

  // Die Einlösung steht in der Historie im Elternbereich.
  await nav.getByRole('link', { name: 'Einstellungen' }).click()
  await enterPin(page, PIN)
  await expect(page.getByRole('heading', { name: 'Eingelöst von Lena' })).toBeVisible()
  await expect(page.getByText('−4', { exact: true })).toBeVisible()
})
