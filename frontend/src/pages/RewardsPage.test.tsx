import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Today } from '../api/today'
import i18n from '../i18n'
import {
  makeMe,
  makeMember,
  makeReward,
  makeToday,
  mockApi,
  renderApp,
  setupDone,
} from '../test/utils'

const lena = makeMember({ id: 1, name: 'Lena', color: 'purple' })
const tom = makeMember({ id: 2, name: 'Tom', color: 'green' })
const mama = makeMember({ id: 3, name: 'Mama', role: 'parent', color: 'blue' })

const iceCream = makeReward({ id: 1, member_id: 1, name: 'Ein Eis', cost: 10 })
const cinema = makeReward({
  id: 2,
  member_id: 1,
  name: 'Kinobesuch',
  icon: 'fluent-emoji-flat:cinema',
  cost: 18,
})
const hidden = makeReward({ id: 3, member_id: 1, name: 'Pizza', active: false })
const tomsReward = makeReward({ id: 4, member_id: 2, name: 'Zoo', cost: 5 })

/** API wie der Server: Einlösen senkt den Punktestand in GET /api/today. */
function routes(extra: Record<string, Response | ((body: unknown) => Response)> = {}) {
  let today: Today = makeToday({
    points: [
      { member_id: 1, today: 0, total: 10, week_done: 0 },
      { member_id: 2, today: 0, total: 3, week_done: 0 },
      { member_id: 3, today: 0, total: 0, week_done: 0 },
    ],
  })
  return {
    'GET /api/setup/status': setupDone,
    'GET /api/auth/me': Response.json(makeMe()),
    'GET /api/members': Response.json([lena, tom, mama]),
    'GET /api/today': () => Response.json(today),
    'GET /api/rewards': Response.json([iceCream, cinema, hidden, tomsReward]),
    'POST /api/rewards/1/redeem': () => {
      today = {
        ...today,
        points: today.points.map((entry) =>
          entry.member_id === 1 ? { ...entry, total: entry.total - 10 } : entry,
        ),
      }
      return Response.json(
        {
          id: 7,
          reward_id: 1,
          member_id: 1,
          status: 'redeemed',
          reward_name: 'Ein Eis',
          reward_icon: iceCream.icon,
          cost: 10,
          created_at: '2026-10-03T10:00:00Z',
        },
        { status: 201 },
      )
    },
    ...extra,
  }
}

beforeEach(async () => {
  await i18n.changeLanguage('de')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Belohnungen am Display', () => {
  it('führt über das Geschenk zu den Kindern und ihren Belohnungen', async () => {
    const user = userEvent.setup()
    mockApi(routes())
    renderApp('/')

    const nav = await screen.findByRole('navigation', { name: 'Hauptnavigation' })
    await user.click(within(nav).getByRole('link', { name: 'Belohnungen' }))

    // Nur Kinder, Erwachsene bekommen keine Belohnungen.
    expect(await screen.findByRole('link', { name: 'Belohnungen von Lena' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Belohnungen von Tom' })).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Belohnungen von Mama' })).toBeNull()
    expect(within(nav).getByRole('link', { name: 'Belohnungen' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    await user.click(screen.getByRole('link', { name: 'Belohnungen von Lena' }))
    expect(await screen.findByRole('heading', { name: 'Belohnungen von Lena' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Ein Eis' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Kinobesuch' })).toBeVisible()
    // Inaktive und fremde Belohnungen sind nicht zu sehen.
    expect(screen.queryByRole('heading', { name: 'Pizza' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Zoo' })).toBeNull()
  })

  it('zeigt „Einlösen“ nur mit genug Punkten, sonst was noch fehlt', async () => {
    mockApi(routes())
    renderApp('/rewards/1')

    expect(await screen.findByRole('button', { name: 'Ein Eis einlösen' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Kinobesuch einlösen' })).toBeNull()
    expect(screen.getByText('Noch 8 Punkte nötig')).toBeVisible()
    expect(screen.getByRole('img', { name: '10 von 18 Punkten' })).toBeVisible()
  })

  it('löst nach Bestätigung ein und zieht die Punkte ab', async () => {
    const user = userEvent.setup()
    const calls = mockApi(routes())
    renderApp('/rewards/1')

    await user.click(await screen.findByRole('button', { name: 'Ein Eis einlösen' }))
    const dialog = screen.getByRole('dialog', { name: 'Ein Eis einlösen?' })
    expect(calls.some((call) => call.key === 'POST /api/rewards/1/redeem')).toBe(false)

    await user.click(within(dialog).getByRole('button', { name: 'Ja, einlösen' }))

    expect(await screen.findByRole('dialog', { name: 'Viel Spaß: Ein Eis!' })).toBeVisible()
    expect(calls.filter((call) => call.key === 'POST /api/rewards/1/redeem')).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Fertig' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(await screen.findByText('Insgesamt 0 Punkte')).toBeInTheDocument()
  })

  it('bricht ohne Einlösen ab', async () => {
    const user = userEvent.setup()
    const calls = mockApi(routes())
    renderApp('/rewards/1')

    await user.click(await screen.findByRole('button', { name: 'Ein Eis einlösen' }))
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(calls.some((call) => call.key.startsWith('POST'))).toBe(false)
  })

  it('zeigt die Ablehnung des Servers verständlich an', async () => {
    const user = userEvent.setup()
    mockApi(
      routes({
        'POST /api/rewards/1/redeem': Response.json(
          { code: 'reward.insufficient_points' },
          { status: 409 },
        ),
      }),
    )
    renderApp('/rewards/1')

    await user.click(await screen.findByRole('button', { name: 'Ein Eis einlösen' }))
    await user.click(screen.getByRole('button', { name: 'Ja, einlösen' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Dafür reichen die Punkte noch nicht',
    )
  })

  it('zeigt die Belohnungen auch in der Personenansicht eines Kindes', async () => {
    mockApi(routes())
    renderApp('/member/1')

    expect(await screen.findByRole('button', { name: 'Ein Eis einlösen' })).toBeVisible()
  })

  it('zeigt Erwachsenen keine Belohnungen', async () => {
    mockApi(routes())
    renderApp('/member/3')

    await screen.findByRole('heading', { name: 'Mama', level: 1 })
    expect(screen.queryByRole('heading', { name: 'Belohnungen' })).toBeNull()
  })

  it('leitet bei Erwachsenen zur Auswahl der Kinder', async () => {
    mockApi(routes())
    renderApp('/rewards/3')

    expect(await screen.findByRole('link', { name: 'Belohnungen von Lena' })).toBeVisible()
  })
})
