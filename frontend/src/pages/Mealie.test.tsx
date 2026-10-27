import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { MealieRecipe, MealieSettings } from '../api/mealie'
import type { Dish } from '../api/meals'
import i18n from '../i18n'
import { makeMe, makeToday, mockApi, renderApp, setupDone } from '../test/utils'

beforeEach(async () => {
  await i18n.changeLanguage('de')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const URL = 'https://mealie.example.org'
const DJUVEC_ID = '8bbef6c5-abc0-43d9-8ad2-26eaa2913569'

const settings = (overrides: Partial<MealieSettings> = {}): MealieSettings => ({
  mode: 'mixed',
  url: URL,
  has_token: true,
  can_store_token: true,
  synced_at: '2026-10-27T10:00:00Z',
  sync_error: null,
  recipes: 1,
  ...overrides,
})

const dish = (overrides: Partial<Dish> = {}): Dish => ({
  id: 1,
  name: 'Hackbällchen mit Djuvec-Reis',
  icon: 'fluent-emoji-flat:spaghetti',
  image_url: null,
  last_planned: '2026-10-27',
  times_planned: 1,
  ingredients: [],
  steps: [],
  servings: null,
  rating: null,
  mealie: null,
  ...overrides,
})

const DJUVEC = dish({
  id: 2,
  name: 'Djuvec Reis',
  image_url: `/api/mealie/images/${DJUVEC_ID}?v=1`,
  ingredients: ['200 g Reis (Langkorn)'],
  steps: ['Reis kochen.'],
  servings: 4,
  mealie: {
    id: DJUVEC_ID,
    name: 'Djuvec Reis',
    url: `${URL}/g/home/r/djuvec-reis`,
    auto: true,
    own_recipe: false,
  },
})

const RECIPES: MealieRecipe[] = [
  {
    id: DJUVEC_ID,
    name: 'Djuvec Reis',
    url: `${URL}/g/home/r/djuvec-reis`,
    image_url: null,
    rating: 4,
  },
]

function mockMealie(
  mealie: MealieSettings,
  dishes: Dish[],
  extra: Parameters<typeof mockApi>[0] = {},
) {
  return mockApi({
    'GET /api/setup/status': setupDone,
    'GET /api/auth/me': Response.json(makeMe({ parent_unlocked: true })),
    'GET /api/today': Response.json(makeToday()),
    'GET /api/mealie': Response.json(mealie),
    'GET /api/mealie/recipes': Response.json(RECIPES),
    'GET /api/dishes': Response.json(dishes),
    [`POST /api/mealie/recipes/${DJUVEC_ID}/refresh`]: new Response(null, { status: 204 }),
    ...extra,
  })
}

const bodyOf = (calls: ReturnType<typeof mockApi>, key: string) =>
  calls.find((call) => call.key === key)?.body

describe('Mealie im Elternbereich', () => {
  it('verbindet mit Adresse und Token und meldet die Rezepte', async () => {
    const user = userEvent.setup()
    const calls = mockMealie(
      settings({ mode: 'off', url: null, has_token: false, recipes: 0 }),
      [],
      {
        'PUT /api/mealie': Response.json(settings({ recipes: 4 })),
      },
    )
    renderApp('/parents/settings')

    const section = within(await screen.findByRole('region', { name: 'Mealie' }))
    await user.click(await section.findByRole('radio', { name: /Gemischt/ }))
    await user.type(section.getByLabelText('Adresse von Mealie'), URL)
    await user.type(section.getByLabelText('API-Token'), 'geheim')
    await user.click(section.getByRole('button', { name: 'Speichern' }))

    expect(bodyOf(calls, 'PUT /api/mealie')).toEqual({ mode: 'mixed', url: URL, token: 'geheim' })
    expect(await screen.findByText('Mit Mealie verbunden: 4 Rezepte.')).toBeVisible()
  })

  it('zeigt einen gespeicherten Token nicht an und meldet Fehler beim Abgleich', async () => {
    mockMealie(settings({ sync_error: 'mealie.unreachable' }), [])
    renderApp('/parents/settings')

    const section = within(await screen.findByRole('region', { name: 'Mealie' }))
    expect(await section.findByLabelText('API-Token')).toHaveValue('')
    expect(section.getByLabelText('API-Token')).toHaveAttribute(
      'placeholder',
      'Gespeichert – leer lassen, um ihn zu behalten',
    )
    expect(section.getByText(/Mealie ist gerade nicht erreichbar/)).toBeVisible()
    expect(section.getByRole('button', { name: 'Jetzt abgleichen' })).toBeVisible()
  })
})

describe('Mealie im Alltag', () => {
  it('hat einen Knopf in der Navigationsleiste, der Mealie öffnet', async () => {
    const user = userEvent.setup()
    mockMealie(settings({ mode: 'link', has_token: false }), [])
    renderApp('/meals/recipes')

    await user.click(await screen.findByRole('link', { name: 'Mealie' }))

    expect(await screen.findByTitle('Mealie')).toHaveAttribute('src', URL)
    expect(screen.getByRole('link', { name: 'Im Browser öffnen' })).toHaveAttribute('href', URL)
  })

  it('ohne Mealie gibt es keinen Knopf', async () => {
    mockMealie(settings({ mode: 'off' }), [])
    renderApp('/meals/recipes')

    await screen.findByRole('heading', { name: 'Rezepte' })
    expect(screen.queryByRole('link', { name: 'Mealie' })).toBeNull()
  })

  it('zeigt im Modus „nur Mealie“ nur dessen Rezepte, ohne „Rezepte einfügen“', async () => {
    const own = dish({ id: 3, name: 'Pfannkuchen', steps: ['Backen'] })
    mockMealie(settings({ mode: 'only' }), [own, DJUVEC])
    renderApp('/meals/recipes')

    const list = within(await screen.findByRole('list', { name: 'Rezepte' }))
    expect(list.getByRole('button', { name: /Djuvec Reis/ })).toBeVisible()
    expect(list.queryByRole('button', { name: /Pfannkuchen/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Rezepte einfügen' })).toBeNull()
  })

  it('zeigt ein Mealie-Rezept zum Kochen und öffnet es in Mealie statt es zu bearbeiten', async () => {
    const user = userEvent.setup()
    const calls = mockMealie(settings(), [DJUVEC])
    renderApp('/meals/recipes')

    await user.click(await screen.findByRole('button', { name: /Djuvec Reis/ }))
    const view = within(await screen.findByRole('dialog', { name: 'Djuvec Reis' }))

    expect(view.getByText('200 g Reis (Langkorn)')).toBeVisible()
    expect(view.getByText('Rezept aus Mealie')).toBeVisible()
    expect(view.queryByRole('button', { name: 'Rezept bearbeiten' })).toBeNull()
    expect(view.queryByRole('button', { name: 'Rezept löschen' })).toBeNull()
    await waitFor(() =>
      expect(calls.map((call) => call.key)).toContain(
        `POST /api/mealie/recipes/${DJUVEC_ID}/refresh`,
      ),
    )

    await user.click(view.getByRole('button', { name: 'In Mealie öffnen' }))
    expect(await screen.findByTitle('Mealie')).toHaveAttribute('src', `${URL}/g/home/r/djuvec-reis`)
  })

  it('verknüpft ein eigenes Gericht mit einem Rezept aus Mealie', async () => {
    const user = userEvent.setup()
    const own = dish({ steps: ['Hackbällchen braten.'] })
    const calls = mockMealie(settings(), [own], {
      'PUT /api/dishes/1/mealie': Response.json(own),
    })
    renderApp('/meals/recipes')

    await user.click(await screen.findByRole('button', { name: /Hackbällchen/ }))
    const view = within(await screen.findByRole('dialog', { name: 'Hackbällchen mit Djuvec-Reis' }))
    await user.click(view.getByRole('button', { name: 'Mit Mealie verknüpfen' }))
    const picker = within(
      await screen.findByRole('dialog', {
        name: 'Rezept aus Mealie für „Hackbällchen mit Djuvec-Reis“',
      }),
    )
    await user.type(picker.getByRole('textbox', { name: 'Rezept suchen' }), 'djuvec')
    await user.click(picker.getByRole('button', { name: 'Djuvec Reis' }))

    expect(bodyOf(calls, 'PUT /api/dishes/1/mealie')).toEqual({ recipe_id: DJUVEC_ID })
  })
})
