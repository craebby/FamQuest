import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import i18n from '../../i18n'
import { makeMe, makeToday, mockApi, renderApp, setupDone } from '../../test/utils'

beforeEach(async () => {
  await i18n.changeLanguage('de')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Einstellungen zum Essensplan', () => {
  it('schaltet Mahlzeiten zu; die letzte bleibt immer an', async () => {
    const user = userEvent.setup()
    // Wie der Server: GET liefert danach, was zuletzt gespeichert wurde.
    let saved: unknown = { meals: ['dinner'] }
    const calls = mockApi({
      'GET /api/setup/status': setupDone,
      'GET /api/auth/me': Response.json(makeMe({ parent_unlocked: true })),
      'GET /api/today': Response.json(makeToday()),
      'GET /api/meals/settings': () => Response.json(saved),
      'PUT /api/meals/settings': (body) => {
        saved = body
        return Response.json(body)
      },
    })
    renderApp('/parents/settings')

    const section = within(await screen.findByRole('region', { name: 'Essensplan' }))
    const dinner = await section.findByRole('switch', { name: 'Abendessen' })
    expect(dinner).toBeChecked()
    expect(dinner).toBeDisabled()
    expect(section.getByRole('switch', { name: 'Snack' })).not.toBeChecked()

    await user.click(section.getByRole('switch', { name: 'Snack' }))

    expect(calls.find((call) => call.key === 'PUT /api/meals/settings')?.body).toEqual({
      meals: ['dinner', 'snack'],
    })
    expect(section.getByRole('switch', { name: 'Snack' })).toBeChecked()
    expect(section.getByRole('switch', { name: 'Abendessen' })).toBeEnabled()
  })
})
