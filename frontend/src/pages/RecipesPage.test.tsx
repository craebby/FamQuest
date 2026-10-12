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
  servings: null,
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

Zutaten für 4 Personen

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
      note: null,
      variant: null,
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
    'DELETE /api/dishes/2/recipe': () => new Response(null, { status: 204 }),
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
    // Gilt nur für Rezepte ohne eigene Angabe: Die Rührei-Pfanne bleibt bei 4.
    await user.type(dialog.getByRole('spinbutton', { name: 'Portionen für alle' }), '3')

    const preview = within(dialog.getByRole('region', { name: 'Erkannt' }))
    expect(preview.getByText('Rührei-Pfanne mit Pellkartoffeln')).toBeVisible()
    expect(preview.getByText('Zutaten: 2 · Schritte: 2 · 4 Portionen')).toBeVisible()
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
          servings: 4,
        },
        {
          name: 'Fischstäbchen',
          icon: 'fluent-emoji-flat:fish',
          ingredients: [],
          steps: ['Fischstäbchen im Ofen backen (15-20 Min).'],
          servings: 3,
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
    await user.type(dialog.getByRole('spinbutton', { name: 'Portionen' }), '4')
    await user.click(dialog.getByRole('button', { name: 'Speichern' }))

    expect(calls.find((call) => call.key === 'PUT /api/dishes/2/recipe')?.body).toEqual({
      ingredients: ['400 g Hähnchenstreifen', '8 Tortillas'],
      steps: ['Alles anbraten.', 'Einrollen.'],
      servings: 4,
    })
    expect(await dialog.findByText('Einrollen.')).toBeVisible()
    expect(dialog.getByText('4 Portionen')).toBeVisible()
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

  it('rechnet die Zutaten auf andere Portionen um', async () => {
    const user = userEvent.setup()
    mockRecipes([{ ...WRAPS, servings: 4 }])
    renderApp('/meals/recipes')

    await user.click(await screen.findByRole('button', { name: /Hähnchen-Wraps/ }))
    const dialog = within(screen.getByRole('dialog', { name: 'Hähnchen-Wraps' }))
    expect(dialog.getByText('4 Portionen')).toBeVisible()
    await user.click(dialog.getByRole('button', { name: 'Mehr Portionen' }))
    await user.click(dialog.getByRole('button', { name: 'Mehr Portionen' }))

    expect(dialog.getByText('6 Portionen')).toBeVisible()
    expect(dialog.getByText('600 g Hähnchenstreifen')).toBeVisible()
    expect(dialog.getByText('12 Tortillas')).toBeVisible()
  })

  it('löscht ein Rezept nach Rückfrage, das Gericht bleibt', async () => {
    const user = userEvent.setup()
    const calls = mockRecipes([{ ...WRAPS, servings: 4 }])
    renderApp('/meals/recipes')

    await user.click(await screen.findByRole('button', { name: /Hähnchen-Wraps/ }))
    const dialog = within(screen.getByRole('dialog', { name: 'Hähnchen-Wraps' }))
    await user.click(dialog.getByRole('button', { name: 'Rezept löschen' }))
    expect(dialog.getByText(/wirklich löschen/)).toBeVisible()
    await user.click(dialog.getByRole('button', { name: 'Rezept löschen' }))

    expect(calls.some((call) => call.key === 'DELETE /api/dishes/2/recipe')).toBe(true)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Hähnchen-Wraps' })).toBeNull())
  })

  it('zeigt ohne Portionen keinen Umrechner', async () => {
    const user = userEvent.setup()
    mockRecipes([WRAPS])
    renderApp('/meals/recipes')

    await user.click(await screen.findByRole('button', { name: /Hähnchen-Wraps/ }))
    const dialog = within(screen.getByRole('dialog', { name: 'Hähnchen-Wraps' }))
    expect(dialog.queryByRole('button', { name: 'Mehr Portionen' })).toBeNull()
  })

  it('setzt die Zutaten eines Rezepts auf die Einkaufsliste, Salz und Vorhandenes erst nicht', async () => {
    const user = userEvent.setup()
    const calls = mockRecipes(
      [{ ...WRAPS, ingredients: [...WRAPS.ingredients, 'Salz', '1 Zwiebel'], servings: 4 }],
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
    // Für zwei statt vier Portionen: Auf die Liste kommen die halben Mengen.
    await user.click(screen.getByRole('button', { name: 'Weniger Portionen' }))
    await user.click(screen.getByRole('button', { name: 'Weniger Portionen' }))
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
        note: '200 g',
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

  it('legt eine Variante nur für den geplanten Tag fest, das Rezept bleibt', async () => {
    const user = userEvent.setup()
    let entry = WEEK.entries[0]
    const calls = mockRecipes([WRAPS], {
      'GET /api/meals/week': () => Response.json({ ...WEEK, entries: [entry] }),
      'PUT /api/meals/2026-10-03/dinner/variant': (body) => {
        const { note, ...variant } = body as { note: string } & NonNullable<typeof entry.variant>
        entry = { ...entry, note, variant }
        return Response.json(entry)
      },
      'DELETE /api/meals/2026-10-03/dinner/variant': () => {
        entry = { ...entry, note: null, variant: null }
        return Response.json(entry)
      },
    })
    renderApp('/meals')

    await user.click(
      await screen.findByRole('button', { name: 'Abendessen: Hähnchen-Wraps, ändern' }),
    )
    const recipe = within(await screen.findByRole('dialog', { name: 'Hähnchen-Wraps' }))
    await user.click(recipe.getByRole('button', { name: 'Nur für diesen Tag ändern' }))
    expect(recipe.getByText(/Gilt nur für Abendessen, Samstag, 3\. Oktober/)).toBeVisible()
    // Vorbefüllt mit dem Rezept.
    const ingredients = recipe.getByLabelText('Zutaten, eine pro Zeile')
    expect(ingredients).toHaveValue('400 g Hähnchenstreifen\n8 Tortillas')
    await user.type(recipe.getByLabelText('Notiz für diesen Tag'), 'mit Tofu')
    await user.clear(ingredients)
    await user.type(ingredients, '400 g Tofu{Enter}8 Tortillas')
    await user.click(recipe.getByRole('button', { name: 'Speichern' }))

    expect(calls.find((call) => call.key.endsWith('/variant'))?.body).toEqual({
      note: 'mit Tofu',
      ingredients: ['400 g Tofu', '8 Tortillas'],
      steps: WRAPS.steps,
      servings: null,
    })
    expect(calls.some((call) => call.key === 'PUT /api/dishes/2/recipe')).toBe(false)
    expect(await recipe.findByText('400 g Tofu')).toBeVisible()
    expect(recipe.getByText('mit Tofu')).toBeVisible()
    await user.click(recipe.getByRole('button', { name: 'Original anzeigen' }))
    expect(recipe.getByText('400 g Hähnchenstreifen')).toBeVisible()

    await user.click(recipe.getByRole('button', { name: 'Variante entfernen' }))
    await waitFor(() => expect(recipe.queryByText('mit Tofu')).toBeNull())
    expect(calls.some((call) => call.key === 'DELETE /api/meals/2026-10-03/dinner/variant')).toBe(
      true,
    )
  })

  it('zeigt die Notiz im Plan und nimmt die Zutaten der Variante für die Woche', async () => {
    const user = userEvent.setup()
    const entry = {
      ...WEEK.entries[0],
      note: 'mit Tofu',
      variant: { ingredients: ['400 g Tofu'], steps: WRAPS.steps, servings: null },
    }
    mockRecipes([WRAPS], {
      'GET /api/meals/week': Response.json({ ...WEEK, entries: [entry] }),
      'GET /api/shopping/list': Response.json({ items: [] }),
      'GET /api/shopping/items': Response.json([]),
    })
    renderApp('/meals')

    const planned = await screen.findByRole('button', {
      name: 'Abendessen: Hähnchen-Wraps, ändern (Notiz: mit Tofu)',
    })
    expect(within(planned).getByText('mit Tofu')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Zutaten der Woche' }))

    const dialog = within(screen.getByRole('dialog', { name: 'Zutaten der Woche' }))
    expect(dialog.getAllByRole('checkbox').map((box) => box.textContent)).toEqual(['Tofu400 g'])
  })
})
