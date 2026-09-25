import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Weather } from '../../api/weather'
import i18n from '../../i18n'
import { makeMe, makeToday, mockApi, renderApp, setupDone } from '../../test/utils'

beforeEach(async () => {
  await i18n.changeLanguage('de')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const NO_WEATHER: Weather = { place: null, current: null, days: [], stale: false }
const KOELN = { name: 'Köln', latitude: 50.94, longitude: 6.96 }

function mockParents(weather: () => Weather, extra = {}) {
  return mockApi({
    'GET /api/setup/status': setupDone,
    'GET /api/auth/me': Response.json(makeMe({ parent_unlocked: true })),
    'GET /api/members': Response.json([]),
    'GET /api/tasks': Response.json([]),
    'GET /api/rewards': Response.json([]),
    'GET /api/approvals': Response.json([]),
    'GET /api/today': Response.json(makeToday()),
    'GET /api/weather': () => Response.json(weather()),
    ...extra,
  })
}

async function weatherSection() {
  return within((await screen.findByRole('heading', { name: 'Wetter', level: 2 })).parentElement!)
}

describe('Wetter im Elternbereich', () => {
  it('sucht einen Ort und legt ihn fest', async () => {
    const user = userEvent.setup()
    let place: Weather['place'] = null
    const calls = mockParents(() => ({ ...NO_WEATHER, place }), {
      'GET /api/weather/places': Response.json([
        { ...KOELN, region: 'Nordrhein-Westfalen', country: 'Deutschland' },
      ]),
      'PUT /api/weather/place': (body: unknown) => {
        place = body as Weather['place']
        return Response.json({ place })
      },
    })
    renderApp('/parents')

    const section = await weatherSection()
    expect(await section.findByText('Noch kein Ort festgelegt')).toBeVisible()
    const search = section.getByRole('button', { name: 'Suchen' })
    expect(search).toBeDisabled()

    await user.type(section.getByLabelText('Ort suchen'), 'Köln')
    // Gesucht wird erst beim Absenden.
    expect(calls.some((call) => call.key === 'GET /api/weather/places')).toBe(false)
    await user.click(search)
    await user.click(
      await section.findByRole('button', { name: 'Köln, Nordrhein-Westfalen, Deutschland' }),
    )

    expect(await screen.findByRole('status')).toHaveTextContent('Wetter für Köln')
    expect(calls.find((call) => call.key === 'PUT /api/weather/place')?.body).toEqual(KOELN)
    expect(await section.findByText('Köln')).toBeVisible()
  })

  it('meldet, wenn nichts gefunden wurde, und entfernt den Ort', async () => {
    const user = userEvent.setup()
    let place: Weather['place'] = KOELN
    const calls = mockParents(() => ({ ...NO_WEATHER, place }), {
      'GET /api/weather/places': Response.json([]),
      'DELETE /api/weather/place': () => {
        place = null
        return Response.json({ place })
      },
    })
    renderApp('/parents')

    const section = await weatherSection()
    await user.type(await section.findByLabelText('Anderen Ort suchen'), 'Xyz')
    await user.click(section.getByRole('button', { name: 'Suchen' }))
    expect(await section.findByText('Kein Ort gefunden')).toBeVisible()

    await user.click(section.getByRole('button', { name: 'Entfernen' }))
    expect(await section.findByText('Noch kein Ort festgelegt')).toBeVisible()
    expect(calls.some((call) => call.key === 'DELETE /api/weather/place')).toBe(true)
  })
})
