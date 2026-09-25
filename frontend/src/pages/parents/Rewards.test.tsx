import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Redemption, Reward, RewardData } from '../../api/rewards'
import i18n from '../../i18n'
import {
  makeMe,
  makeMember,
  makeReward,
  makeToday,
  mockApi,
  renderApp,
  setupDone,
} from '../../test/utils'

const lena = makeMember({ id: 1, name: 'Lena', color: 'purple' })
const tom = makeMember({ id: 2, name: 'Tom', color: 'green' })
const mama = makeMember({ id: 3, name: 'Mama', role: 'parent', color: 'blue' })

const iceCream = makeReward({ id: 1, member_id: 1, name: 'Ein Eis', cost: 10 })
const zoo = makeReward({ id: 2, member_id: 2, name: 'Zoo', icon: 'fluent-emoji-flat:giraffe' })

const redemption: Redemption = {
  id: 5,
  reward_id: 1,
  member_id: 1,
  status: 'redeemed',
  reward_name: 'Ein Eis',
  reward_icon: iceCream.icon,
  cost: 10,
  created_at: '2026-10-03T10:00:00Z',
}

function api(extra: Record<string, Response | ((body: unknown) => Response)> = {}) {
  let nextId = 10
  return mockApi({
    'GET /api/setup/status': setupDone,
    'GET /api/auth/me': Response.json(makeMe({ parent_unlocked: true })),
    'GET /api/members': Response.json([lena, tom, mama]),
    'GET /api/tasks': Response.json([]),
    'GET /api/today': Response.json(makeToday()),
    'GET /api/rewards': Response.json([iceCream, zoo]),
    'GET /api/redemptions': Response.json({ redemptions: [redemption], has_more: false }),
    'POST /api/rewards': (body) =>
      Response.json({ id: nextId++, ...(body as RewardData) } satisfies Reward, { status: 201 }),
    ...extra,
  })
}

function rewardsSection() {
  return within(screen.getByRole('heading', { name: 'Belohnungen', level: 2 }).parentElement!)
}

beforeEach(async () => {
  await i18n.changeLanguage('de')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Belohnungen im Elternbereich', () => {
  it('zeigt die Belohnungen je Kind und die eingelösten', async () => {
    const user = userEvent.setup()
    api()
    renderApp('/parents')

    await screen.findByRole('button', { name: 'Ein Eis bearbeiten' })
    const section = rewardsSection()
    // Nur Kinder stehen zur Wahl.
    const chooser = section.getByRole('group', { name: 'Kind wählen' })
    expect(within(chooser).getByRole('button', { name: 'Lena' })).toBeVisible()
    expect(within(chooser).getByRole('button', { name: 'Tom' })).toBeVisible()
    expect(within(chooser).queryByRole('button', { name: 'Mama' })).toBeNull()
    expect(section.queryByRole('button', { name: 'Zoo bearbeiten' })).toBeNull()
    expect(section.getByRole('heading', { name: 'Eingelöst von Lena' })).toBeVisible()
    expect(await section.findByText('−10')).toBeVisible()

    await user.click(within(chooser).getByRole('button', { name: 'Tom' }))
    expect(section.getByRole('button', { name: 'Zoo bearbeiten' })).toBeVisible()
    expect(section.queryByRole('button', { name: 'Ein Eis bearbeiten' })).toBeNull()
  })

  it('übernimmt mehrere Vorschläge auf einmal', async () => {
    const user = userEvent.setup()
    const calls = api()
    renderApp('/parents')

    await user.click(await screen.findByRole('button', { name: 'Aus Vorschlägen wählen' }))
    expect(
      screen.getByRole('heading', { name: 'Belohnungen für Lena auswählen', level: 1 }),
    ).toBeVisible()
    // „Ein Eis“ hat Lena schon.
    expect(screen.getByRole('checkbox', { name: /Ein Eis/ })).toBeDisabled()

    await user.click(screen.getByRole('checkbox', { name: /Schaumbad/ }))
    await user.click(screen.getByRole('checkbox', { name: /Kinobesuch/ }))
    await user.click(screen.getByRole('button', { name: '2 Belohnungen hinzufügen' }))

    expect(await screen.findByText('Lena hat 2 neue Belohnungen.')).toBeVisible()
    const bodies = calls.filter((call) => call.key === 'POST /api/rewards').map((c) => c.body)
    expect(bodies).toEqual([
      {
        member_id: 1,
        name: 'Schaumbad',
        icon: 'fluent-emoji-flat:bathtub',
        description: '',
        cost: 10,
        active: true,
      },
      {
        member_id: 1,
        name: 'Kinobesuch',
        icon: 'fluent-emoji-flat:cinema',
        description: '',
        cost: 80,
        active: true,
      },
    ])
  })

  it('legt eine eigene Belohnung an', async () => {
    const user = userEvent.setup()
    const calls = api()
    renderApp('/parents')

    await user.click(await screen.findByRole('button', { name: 'Eigene Belohnung' }))
    await user.type(screen.getByLabelText('Name'), 'Popcorn essen')
    await user.click(screen.getByRole('button', { name: 'Mehr Punkte' }))
    await user.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(await screen.findByText('„Popcorn essen“ ist gespeichert.')).toBeVisible()
    expect(calls.find((call) => call.key === 'POST /api/rewards')?.body).toEqual({
      member_id: 1,
      name: 'Popcorn essen',
      // Aus dem Namen vorgeschlagen.
      icon: 'fluent-emoji-flat:popcorn',
      description: '',
      cost: 11,
      active: true,
    })
  })

  it('verlangt einen Namen', async () => {
    const user = userEvent.setup()
    const calls = api()
    renderApp('/parents')

    await user.click(await screen.findByRole('button', { name: 'Eigene Belohnung' }))
    await user.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(screen.getByLabelText('Name')).toHaveAccessibleDescription('Bitte ausfüllen')
    expect(calls.some((call) => call.key === 'POST /api/rewards')).toBe(false)
  })

  it('schaltet eine Belohnung inaktiv', async () => {
    const user = userEvent.setup()
    const calls = api({ 'PUT /api/rewards/1': Response.json({ ...iceCream, active: false }) })
    renderApp('/parents')

    await user.click(await screen.findByRole('switch', { name: 'Ein Eis aktiv' }))

    expect(calls.find((call) => call.key === 'PUT /api/rewards/1')?.body).toMatchObject({
      active: false,
    })
  })

  it('verweist ohne Kinder darauf, erst eines anzulegen', async () => {
    api({ 'GET /api/members': Response.json([mama]) })
    renderApp('/parents')

    expect(
      await screen.findByText('Belohnungen gibt es nur für Kinder. Legt zuerst ein Kind an.'),
    ).toBeVisible()
  })
})
