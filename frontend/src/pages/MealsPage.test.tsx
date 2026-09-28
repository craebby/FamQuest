import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Dish, MealWeek } from '../api/meals'
import i18n from '../i18n'
import { makeMe, mockApi, renderApp, setupDone } from '../test/utils'

// Der echte Cropper braucht Layout und Canvas, die jsdom nicht hat.
vi.mock('../components/AvatarCropper', () => ({
  AvatarCropper: ({ onConfirm }: { onConfirm: (image: Blob) => void }) => (
    <button type="button" onClick={() => onConfirm(new Blob(['x'], { type: 'image/webp' }))}>
      Zuschnitt fertig
    </button>
  ),
}))

beforeEach(async () => {
  await i18n.changeLanguage('de')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const WEEK: MealWeek = {
  start: '2026-09-28',
  today: '2026-10-03',
  meals: ['dinner'],
  entries: [
    {
      date: '2026-10-02',
      meal: 'dinner',
      dish_id: 1,
      name: 'Fischstäbchen',
      icon: 'fluent-emoji-flat:fish',
      image_url: null,
    },
  ],
}

const DISHES: Dish[] = [
  {
    id: 1,
    name: 'Fischstäbchen',
    icon: 'fluent-emoji-flat:fish',
    image_url: null,
    last_planned: '2026-10-02',
    times_planned: 4,
  },
]

function mockMeals(
  week: MealWeek = WEEK,
  language = 'de',
  extra: Parameters<typeof mockApi>[0] = {},
) {
  return mockApi({
    'GET /api/setup/status': setupDone,
    'GET /api/auth/me': Response.json(
      makeMe({ family: { ...makeMe().family, default_language: language } }),
    ),
    'GET /api/meals/week': Response.json(week),
    'GET /api/dishes': Response.json(DISHES),
    'PUT /api/meals/2026-10-03/dinner': (body) =>
      Response.json({ date: '2026-10-03', meal: 'dinner', dish_id: 2, ...(body as object) }),
    'DELETE /api/meals/2026-10-02/dinner': new Response(null, { status: 204 }),
    ...extra,
  })
}

const todayButton = async (name: string) =>
  within(await screen.findByRole('region', { name: 'Samstag, 3. Oktober' })).getByRole('button', {
    name,
  })

const day = (name: string) => within(screen.getByRole('region', { name }))

describe('Essensplan', () => {
  it('zeigt die Woche mit geplanten Gerichten, heute hervorgehoben', async () => {
    mockMeals()
    renderApp('/meals')

    expect(
      await screen.findByRole('heading', { level: 1, name: /^28\. September.*4\. Oktober$/ }),
    ).toBeVisible()
    expect(screen.getAllByRole('region')).toHaveLength(7)
    expect(
      day('Freitag, 2. Oktober').getByRole('button', {
        name: 'Abendessen: Fischstäbchen, ändern',
      }),
    ).toBeVisible()
    const today = screen.getByRole('region', { name: 'Samstag, 3. Oktober' })
    expect(today).toHaveAttribute('aria-current', 'date')
    expect(within(today).getByRole('button', { name: 'Abendessen eintragen' })).toBeVisible()
  })

  it('ist über die Navigationsleiste erreichbar', async () => {
    mockMeals()
    renderApp('/meals')

    const nav = await screen.findByRole('navigation', { name: 'Hauptnavigation' })
    expect(within(nav).getByRole('link', { name: 'Essen' })).toHaveAttribute('aria-current', 'page')
  })

  it('trägt ein Gericht per Antippen eines Vorschlags ein', async () => {
    const user = userEvent.setup()
    const calls = mockMeals()
    renderApp('/meals')

    await user.click(await todayButton('Abendessen eintragen'))
    const dialog = screen.getByRole('dialog', { name: 'Abendessen, Samstag, 3. Oktober' })
    const suggestions = within(dialog).getByRole('list', { name: 'Vorschläge' })
    // Eigene Gerichte zuerst, danach die Standardgerichte.
    const items = within(suggestions).getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Fischstäbchen')
    expect(items[1]).toHaveTextContent('Nudeln mit Tomatensoße')

    await user.click(within(items[1]).getByRole('button'))

    expect(calls.find((call) => call.key === 'PUT /api/meals/2026-10-03/dinner')?.body).toEqual({
      name: 'Nudeln mit Tomatensoße',
      icon: 'fluent-emoji-flat:spaghetti',
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('legt ein eingetipptes Gericht mit passendem Symbol an', async () => {
    const user = userEvent.setup()
    const calls = mockMeals()
    renderApp('/meals')

    await user.click(await todayButton('Abendessen eintragen'))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByRole('textbox', { name: 'Gericht' }), 'Schnitzel mit Reis')
    expect(within(dialog).getByText(/Kein Vorschlag passt/)).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'Speichern' }))

    expect(calls.find((call) => call.key === 'PUT /api/meals/2026-10-03/dinner')?.body).toEqual({
      name: 'Schnitzel mit Reis',
      icon: 'fluent-emoji-flat:cut-of-meat',
    })
  })

  it('lässt das Symbol selbst wählen', async () => {
    const user = userEvent.setup()
    const calls = mockMeals()
    renderApp('/meals')

    await user.click(await todayButton('Abendessen eintragen'))
    await user.type(screen.getByRole('textbox', { name: 'Gericht' }), 'Überraschung')
    await user.click(screen.getByRole('button', { name: 'Symbol ändern' }))
    const picker = screen.getByRole('dialog', { name: 'Symbol wählen' })
    // Der Picker öffnet bei den Gerichten.
    expect(within(picker).getByRole('button', { name: 'Gerichte' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await user.click(within(picker).getByRole('button', { name: 'Burger' }))
    await user.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(calls.find((call) => call.key === 'PUT /api/meals/2026-10-03/dinner')?.body).toEqual({
      name: 'Überraschung',
      icon: 'fluent-emoji-flat:hamburger',
    })
  })

  it('nimmt ein Gericht aus dem Plan', async () => {
    const user = userEvent.setup()
    const calls = mockMeals()
    renderApp('/meals')

    await user.click(
      await screen.findByRole('button', { name: 'Abendessen: Fischstäbchen, ändern' }),
    )
    await user.click(screen.getByRole('button', { name: 'Aus dem Plan nehmen' }))

    expect(calls.map((call) => call.key)).toContain('DELETE /api/meals/2026-10-02/dinner')
  })

  it('zeigt bei mehreren Mahlzeiten jede mit Namen', async () => {
    mockMeals({ ...WEEK, meals: ['lunch', 'dinner'] })
    renderApp('/meals')

    const today = await screen.findByRole('region', { name: 'Samstag, 3. Oktober' })
    expect(within(today).getByRole('button', { name: 'Mittagessen eintragen' })).toBeVisible()
    expect(within(today).getByRole('button', { name: 'Abendessen eintragen' })).toBeVisible()
  })

  it('funktioniert auch auf Englisch', async () => {
    await i18n.changeLanguage('en')
    mockMeals(WEEK, 'en')
    renderApp('/meals')

    expect(
      await screen.findByRole('button', { name: 'Dinner: Fischstäbchen, change' }),
    ).toBeVisible()
    expect(screen.getAllByRole('button', { name: 'Add Dinner' })).toHaveLength(6)
  })

  it('bearbeitet ein eigenes Gericht über den Stift: Name und Foto', async () => {
    const user = userEvent.setup()
    const saved = (body: unknown) => Response.json({ ...DISHES[0], ...(body as object) })
    const calls = mockMeals(WEEK, 'de', {
      'PUT /api/dishes/1': saved,
      'PUT /api/dishes/1/image': () =>
        Response.json({ ...DISHES[0], image_url: '/api/dish-images/abc.webp' }),
    })
    renderApp('/meals')

    await user.click(await todayButton('Abendessen eintragen'))
    // Nur eigene Gerichte haben einen Stift, Standardgerichte nicht.
    expect(screen.queryByRole('button', { name: 'Pizza bearbeiten' })).not.toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Fischstäbchen bearbeiten' }))
    expect(screen.getByRole('heading', { name: 'Fischstäbchen bearbeiten' })).toBeVisible()

    await user.upload(
      screen.getByTestId('dish-photo-input'),
      new File(['foto'], 'fisch.jpg', { type: 'image/jpeg' }),
    )
    await user.click(screen.getByRole('button', { name: 'Zuschnitt fertig' }))
    const upload = calls.find((call) => call.key === 'PUT /api/dishes/1/image')
    expect(upload?.body).toBeInstanceOf(Blob)

    const name = screen.getByRole('textbox', { name: 'Gericht' })
    await user.clear(name)
    await user.type(name, 'Fischstäbchen mit Kartoffelbrei')
    await user.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(calls.find((call) => call.key === 'PUT /api/dishes/1')?.body).toEqual({
      name: 'Fischstäbchen mit Kartoffelbrei',
      icon: 'fluent-emoji-flat:fish',
    })
    // Zurück bei den Vorschlägen.
    expect(await screen.findByRole('list', { name: 'Vorschläge' })).toBeVisible()
  })

  it('zeigt Fotos statt Symbolen', async () => {
    mockMeals({
      ...WEEK,
      entries: [{ ...WEEK.entries[0], image_url: '/api/dish-images/abc.webp' }],
    })
    const { container } = renderApp('/meals')

    await screen.findByRole('button', { name: 'Abendessen: Fischstäbchen, ändern' })
    expect(container.querySelector('img[src="/api/dish-images/abc.webp"]')).not.toBeNull()
  })

  it('löscht ein Gericht nach Rückfrage und meldet, wenn es noch geplant ist', async () => {
    const user = userEvent.setup()
    const calls = mockMeals(WEEK, 'de', {
      'DELETE /api/dishes/1': Response.json({ code: 'dish.planned' }, { status: 409 }),
    })
    renderApp('/meals')

    await user.click(await todayButton('Abendessen eintragen'))
    await user.click(await screen.findByRole('button', { name: 'Fischstäbchen bearbeiten' }))
    await user.click(screen.getByRole('button', { name: 'Gericht löschen' }))
    expect(screen.getByText(/wirklich löschen/)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Gericht löschen' }))

    expect(calls.map((call) => call.key)).toContain('DELETE /api/dishes/1')
    expect(await screen.findByRole('alert')).toHaveTextContent('Das Gericht steht noch im Plan.')
  })
})
