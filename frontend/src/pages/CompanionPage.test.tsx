import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Companion, Companions } from '../api/companions'
import i18n from '../i18n'
import {
  makeMe,
  makeMember,
  makeToday,
  makeTodayTask,
  mockApi,
  renderApp,
  setupDone,
} from '../test/utils'

const lena = makeMember({ id: 1, name: 'Lena', color: 'purple' })
const mama = makeMember({ id: 3, name: 'Mama', role: 'parent', color: 'blue' })

function makeCompanion(overrides: Partial<Companion> = {}): Companion {
  return {
    member_id: 1,
    mode: 'both',
    species: null,
    name: '',
    stage: 'egg',
    care_days: 0,
    next_stage_at: 2,
    tricks: [],
    next_trick_at: 14,
    owned: [],
    equipped: {},
    ...overrides,
  }
}

function companions(companion: Companion): Companions {
  return {
    species: ['cat', 'fox', 'snow_leopard'],
    items: [
      { key: 'ribbon', slot: 'head', cost: 15 },
      { key: 'crown', slot: 'head', cost: 60 },
    ],
    companions: [companion],
  }
}

const today = makeToday({
  tasks: [
    makeTodayTask({ id: 1, title: 'Zähne putzen', member_ids: [1], done_member_ids: [1] }),
    makeTodayTask({ id: 2, title: 'Anziehen', member_ids: [1], done_member_ids: [] }),
  ],
  points: [
    { member_id: 1, today: 2, total: 20 },
    { member_id: 3, today: 0, total: 0 },
  ],
})

/** API wie der Server: Änderungen am Tier gelten auch für den nächsten Abruf. */
function routes(companion: Companion, changes: Record<string, Companion> = {}) {
  let current = companion
  const writes = Object.fromEntries(
    Object.entries(changes).map(([key, next]) => [
      key,
      () => {
        current = next
        return Response.json(next, { status: key.startsWith('POST') ? 201 : 200 })
      },
    ]),
  )
  return {
    'GET /api/setup/status': setupDone,
    'GET /api/auth/me': Response.json(makeMe()),
    'GET /api/members': Response.json([lena, mama]),
    'GET /api/today': Response.json(today),
    'GET /api/companions': () => Response.json(companions(current)),
    ...writes,
  }
}

beforeEach(async () => {
  window.localStorage.clear()
  await i18n.changeLanguage('de')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Begleiter-Tier', () => {
  it('führt über die Pfote direkt zum einzigen Kind, das sich ein Tier aussucht', async () => {
    const user = userEvent.setup()
    const chosen = makeCompanion({ species: 'snow_leopard', name: 'Flocke' })
    const calls = mockApi(routes(makeCompanion(), { 'PUT /api/members/1/companion': chosen }))
    renderApp('/')

    const nav = await screen.findByRole('navigation', { name: 'Hauptnavigation' })
    await user.click(await within(nav).findByRole('link', { name: 'Tier' }))
    expect(await screen.findByRole('heading', { name: 'Such dir ein Tier aus!' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Schneeleopard' }))
    await user.type(screen.getByLabelText('Name (freiwillig)'), 'Flocke')
    await user.click(screen.getByRole('button', { name: 'Das ist mein Tier!' }))

    expect(calls.find((call) => call.key === 'PUT /api/members/1/companion')?.body).toEqual({
      species: 'snow_leopard',
      name: 'Flocke',
    })
    expect(await screen.findByRole('heading', { name: 'Flocke' })).toBeVisible()
  })

  it('zeigt Futter, Wachstum und kauft Zubehör mit Punkten', async () => {
    const user = userEvent.setup()
    const fox = makeCompanion({
      species: 'fox',
      name: 'Fuxi',
      stage: 'baby',
      care_days: 3,
      next_stage_at: 7,
    })
    const calls = mockApi(
      routes(fox, {
        'POST /api/members/1/companion/items/ribbon': {
          ...fox,
          owned: ['ribbon'],
          equipped: { head: 'ribbon' },
        },
      }),
    )
    renderApp('/companion/1')

    expect(await screen.findByRole('heading', { name: 'Fuxi' })).toBeVisible()
    expect(screen.getByRole('img', { name: 'Heute 1 Portion Futter' })).toBeVisible()
    expect(screen.getByRole('img', { name: 'Noch 4 Tage bis zum nächsten Wachsen' })).toBeVisible()
    // Zu teuer: die Krone ist gesperrt.
    expect(screen.getByRole('button', { name: 'Krone für 60 Punkte' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Schleife für 15 Punkte' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Kaufen' }))
    expect(calls.some((call) => call.key === 'POST /api/members/1/companion/items/ribbon')).toBe(
      true,
    )
    expect(await screen.findByRole('button', { name: 'Schleife ablegen' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('blendet Belohnungen aus, wenn das Kind nur ein Tier hat', async () => {
    mockApi({
      ...routes(makeCompanion({ mode: 'companion' })),
      'GET /api/members': Response.json([{ ...lena, companion_mode: 'companion' }, mama]),
    })
    renderApp('/')
    const nav = await screen.findByRole('navigation', { name: 'Hauptnavigation' })
    expect(await within(nav).findByRole('link', { name: 'Tier' })).toBeVisible()
    expect(within(nav).queryByRole('link', { name: 'Belohnungen' })).toBeNull()
  })
})
