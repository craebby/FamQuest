import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Dish, MealWeek } from '../api/meals'
import i18n from '../i18n'
import { makeMe, mockApi, renderApp, setupDone } from '../test/utils'

beforeEach(async () => {
  await i18n.changeLanguage('de')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const dish = (overrides: Partial<Dish> = {}): Dish => ({
  id: 1,
  name: 'Fischstäbchen',
  icon: 'fluent-emoji-flat:fish',
  image_url: null,
  last_planned: '2026-10-02',
  times_planned: 4,
  ingredients: [],
  steps: [],
  rating: null,
  ...overrides,
})

const WRAPS = dish({
  id: 2,
  name: 'Hähnchen-Wraps',
  icon: 'fluent-emoji-flat:burrito',
  ingredients: ['400 g Hähnchenstreifen', '8 Tortillas'],
  steps: ['Hähnchen 6 Min anbraten.', 'Tortillas kurz erwärmen.'],
  rating: 4,
})

const PASTED = `1. Rührei-Pfanne mit Pellkartoffeln (heute)

Zutaten

ca. 600 g Pellkartoffeln
8 Eier

Zubereitung

Pellkartoffeln anbraten.
Eier drübergießen.

2. Fischstäbchen

Fischstäbchen im Ofen backen (15-20 Min).`

const WEEK: MealWeek = {
  start: '2026-09-28',
  today: '2026-10-03',
  meals: ['dinner'],
  entries: [
    {
      date: '2026-10-03',
      meal: 'dinner',
      dish_id: 2,
      name: 'Hähnchen-Wraps',
      icon: 'fluent-emoji-flat:burrito',
      image_url: null,
    },
  ],
}

function mockRecipes(dishes: Dish[], extra: Parameters<typeof mockApi>[0] = {}) {
  let current = dishes
  const replace = (changed: Dish) => {
    current = current.map((item) => (item.id === changed.id ? changed : item))
    return Response.json(changed)
  }
  return mockApi({
    'GET /api/setup/status': setupDone,
    'GET /api/auth/me': Response.json(makeMe()),
    'GET /api/dishes': () => Response.json(current),
    'GET /api/meals/week': Response.json(WEEK),
    'POST /api/recipes': (body) => {
      const { recipes } = body as { recipes: Omit<Dish, 'id'>[] }
      const saved = recipes.map((recipe, index) => dish({ ...recipe, id: 10 + index }))
      current = [...current.filter((item) => item.name !== 'Fischstäbchen'), ...saved]
      return Response.json(saved)
    },
    'PUT /api/dishes/2/rating': (body) => replace({ ...WRAPS, ...(body as object) }),
    'PUT /api/dishes/2/recipe': (body) => replace({ ...WRAPS, ...(body as object) }),
    ...extra,
  })
}

describe('Rezepte', () => {
  it('ist vom Essensplan aus erreichbar und zeigt nur Gerichte mit Rezept', async () => {
    const user = userEvent.setup()
    mockRecipes([dish(), WRAPS])
    renderApp('/meals')

    await user.click(await screen.findByRole('link', { name: 'Rezepte' }))

    const list = within(await screen.findByRole('list', { name: 'Rezepte' }))
    expect(list.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Hähnchen-Wraps',
    ])
    expect(list.getByRole('img', { name: '4 Sterne' })).toBeInTheDocument()
  })

  it('fügt Text ein, zeigt die Vorschau und speichert die Rezepte', async () => {
    const user = userEvent.setup()
    const calls = mockRecipes([dish()])
    renderApp('/meals/recipes')

    await user.click(await screen.findByRole('button', { name: 'Rezepte einfügen' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Rezepte einfügen' }))
    expect(dialog.getByRole('button', { name: '0 Rezepte speichern' })).toBeDisabled()
    await user.click(dialog.getByRole('textbox', { name: 'Text mit Rezepten' }))
    await user.paste(PASTED)

    const preview = within(dialog.getByRole('region', { name: 'Erkannt' }))
    expect(preview.getByText('Rührei-Pfanne mit Pellkartoffeln')).toBeVisible()
    expect(preview.getByText('Zutaten: 2 · Schritte: 2')).toBeVisible()
    expect(preview.getByText('neu')).toBeVisible()
    // Fischstäbchen gibt es schon als Gericht; es bekommt nur das Rezept.
    expect(preview.getByText('Gericht gibt es schon')).toBeVisible()

    await user.click(dialog.getByRole('button', { name: '2 Rezepte speichern' }))

    expect(await dialog.findByText('2 Rezepte gespeichert.')).toBeVisible()
    const [body] = calls.filter((call) => call.key === 'POST /api/recipes').map((c) => c.body)
    expect(body).toEqual({
      recipes: [
        {
          name: 'Rührei-Pfanne mit Pellkartoffeln',
          icon: expect.stringMatching(/^fluent-emoji-flat:/),
          ingredients: ['ca. 600 g Pellkartoffeln', '8 Eier'],
          steps: ['Pellkartoffeln anbraten.', 'Eier drübergießen.'],
        },
        {
          name: 'Fischstäbchen',
          icon: 'fluent-emoji-flat:fish',
          ingredients: [],
          steps: ['Fischstäbchen im Ofen backen (15-20 Min).'],
        },
      ],
    })
    await user.click(dialog.getByRole('button', { name: 'Fertig' }))
    expect(await screen.findByRole('button', { name: /Rührei-Pfanne/ })).toBeVisible()
  })

  it('öffnet ein Rezept zum Mitkochen, bewertet und bearbeitet es', async () => {
    const user = userEvent.setup()
    const calls = mockRecipes([WRAPS])
    renderApp('/meals/recipes')

    await user.click(await screen.findByRole('button', { name: /Hähnchen-Wraps/ }))
    const dialog = within(screen.getByRole('dialog', { name: 'Hähnchen-Wraps' }))
    expect(dialog.getByText('8 Tortillas')).toBeVisible()
    expect(
      within(dialog.getByRole('region', { name: 'Zubereitung' }))
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['1Hähnchen 6 Min anbraten.', '2Tortillas kurz erwärmen.'])

    const stars = within(dialog.getByRole('group', { name: 'Bewertung' }))
    expect(stars.getByRole('button', { name: '4 Sterne' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(stars.getByRole('button', { name: '5 Sterne' }))
    expect(calls.find((call) => call.key === 'PUT /api/dishes/2/rating')?.body).toEqual({
      rating: 5,
    })

    await user.click(dialog.getByRole('button', { name: 'Rezept bearbeiten' }))
    const steps = dialog.getByRole('textbox', { name: 'Zubereitung, ein Schritt pro Zeile' })
    await user.clear(steps)
    await user.type(steps, 'Alles anbraten.{Enter}{Enter}  Einrollen.  ')
    await user.click(dialog.getByRole('button', { name: 'Speichern' }))

    expect(calls.find((call) => call.key === 'PUT /api/dishes/2/recipe')?.body).toEqual({
      ingredients: ['400 g Hähnchenstreifen', '8 Tortillas'],
      steps: ['Alles anbraten.', 'Einrollen.'],
    })
    expect(await dialog.findByText('Einrollen.')).toBeVisible()
  })

  it('zeigt im Essensplan beim Gericht mit Rezept zuerst das Rezept', async () => {
    const user = userEvent.setup()
    mockRecipes([WRAPS])
    renderApp('/meals')

    await user.click(
      await screen.findByRole('button', { name: 'Abendessen: Hähnchen-Wraps, ändern' }),
    )
    const recipe = within(await screen.findByRole('dialog', { name: 'Hähnchen-Wraps' }))
    expect(recipe.getByText('Tortillas kurz erwärmen.')).toBeVisible()

    await user.click(recipe.getByRole('button', { name: 'Anderes Gericht' }))
    const editor = within(await screen.findByRole('dialog', { name: /Abendessen/ }))
    // Von dort führt „Rezept“ zurück.
    await user.click(editor.getByRole('button', { name: 'Rezept' }))
    expect(await screen.findByRole('dialog', { name: 'Hähnchen-Wraps' })).toBeVisible()
  })

  it('füllt die Woche aus den Rezepten und meldet, wie viele Tage', async () => {
    const user = userEvent.setup()
    const calls = mockRecipes([WRAPS], {
      'POST /api/meals/fill': Response.json([WEEK.entries[0]]),
    })
    renderApp('/meals')

    await user.click(await screen.findByRole('button', { name: 'Woche füllen' }))

    expect(await screen.findByText('1 Tag aus den Rezepten gefüllt.')).toBeVisible()
    expect(calls.find((call) => call.key === 'POST /api/meals/fill')?.body).toEqual({
      start: '2026-09-28',
      end: '2026-10-04',
      meal: 'dinner',
    })
  })

  it('erklärt, wenn es noch keine Rezepte zum Füllen gibt', async () => {
    const user = userEvent.setup()
    mockRecipes([], {
      'POST /api/meals/fill': Response.json({ code: 'meals.no_recipes' }, { status: 409 }),
    })
    renderApp('/meals')

    await user.click(await screen.findByRole('button', { name: 'Woche füllen' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/Noch keine Rezepte/)
  })

  it('würfelt einen geplanten Tag im Rezept neu', async () => {
    const user = userEvent.setup()
    const calls = mockRecipes([WRAPS], {
      'POST /api/meals/fill': Response.json([WEEK.entries[0]]),
    })
    renderApp('/meals')

    await user.click(
      await screen.findByRole('button', { name: 'Abendessen: Hähnchen-Wraps, ändern' }),
    )
    const recipe = within(await screen.findByRole('dialog', { name: 'Hähnchen-Wraps' }))
    await user.click(recipe.getByRole('button', { name: 'Neu würfeln' }))

    expect(calls.find((call) => call.key === 'POST /api/meals/fill')?.body).toEqual({
      start: '2026-10-03',
      end: '2026-10-03',
      meal: 'dinner',
      replace: true,
    })
  })

  it('setzt die Zutaten eines Rezepts auf die Einkaufsliste, Salz und Vorhandenes erst nicht', async () => {
    const user = userEvent.setup()
    const calls = mockRecipes(
      [{ ...WRAPS, ingredients: [...WRAPS.ingredients, 'Salz', '1 Zwiebel'] }],
      {
        'GET /api/shopping/list': Response.json({
          items: [
            { id: 5, name: 'Zwiebel', icon: 'fluent-emoji-flat:onion', note: null, checked: false },
          ],
        }),
        'GET /api/shopping/items': Response.json([]),
        'POST /api/shopping/list': (body) =>
          Response.json({ id: 9, checked: false, ...(body as object) }),
      },
    )
    renderApp('/meals/recipes')

    await user.click(await screen.findByRole('button', { name: /Hähnchen-Wraps/ }))
    await user.click(screen.getByRole('button', { name: 'Auf die Einkaufsliste' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Zutaten für „Hähnchen-Wraps“' }))

    const box = (name: RegExp) => dialog.getByRole('checkbox', { name })
    await waitFor(() => expect(box(/Hähnchenstreifen/)).toHaveAttribute('aria-checked', 'true'))
    expect(box(/Tortillas/)).toHaveAttribute('aria-checked', 'true')
    expect(box(/Salz/)).toHaveAttribute('aria-checked', 'false')
    expect(box(/Zwiebel/)).toHaveAttribute('aria-checked', 'false')
    expect(box(/Zwiebel/)).toHaveTextContent('steht schon drauf')
    await user.click(box(/Tortillas/))

    await user.click(dialog.getByRole('button', { name: '1 Artikel auf die Liste' }))

    expect(await dialog.findByText('1 Artikel steht jetzt auf der Einkaufsliste.')).toBeVisible()
    expect(
      calls.filter((call) => call.key === 'POST /api/shopping/list').map((c) => c.body),
    ).toEqual([
      {
        name: 'Hähnchenstreifen',
        icon: expect.stringMatching(/^fluent-emoji-flat:/),
        note: '400 g',
      },
    ])
  })

  it('sammelt die Zutaten der geplanten Rezepte der Woche', async () => {
    const user = userEvent.setup()
    mockRecipes([WRAPS], {
      'GET /api/shopping/list': Response.json({ items: [] }),
      'GET /api/shopping/items': Response.json([]),
    })
    renderApp('/meals')

    await user.click(await screen.findByRole('button', { name: 'Zutaten der Woche' }))

    const dialog = within(screen.getByRole('dialog', { name: 'Zutaten der Woche' }))
    expect(dialog.getAllByRole('checkbox').map((box) => box.textContent)).toEqual([
      'Hähnchenstreifen400 g',
      'Tortillas8',
    ])
  })
})
