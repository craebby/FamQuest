import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { PointHistory, PointTransaction } from '../../api/points'
import i18n from '../../i18n'
import { makeMe, makeMember, makeToday, mockApi, renderApp, setupDone } from '../../test/utils'

const lena = makeMember()
const tom = makeMember({ id: 2, name: 'Tom', color: 'green' })

function makeTransaction(overrides: Partial<PointTransaction> = {}): PointTransaction {
  return {
    id: 1,
    amount: 2,
    kind: 'task_completed',
    reason: 'Zähne putzen',
    icon: 'fluent-emoji-flat:toothbrush',
    task_date: '2026-10-03',
    created_at: '2026-10-03T05:30:00Z',
    ...overrides,
  }
}

const history: PointHistory = {
  total: 7,
  transactions: [
    makeTransaction({
      id: 3,
      amount: 5,
      kind: 'manual',
      reason: 'Beim Aufräumen geholfen',
      icon: null,
      task_date: null,
    }),
    makeTransaction({ id: 2, amount: -2, kind: 'task_undone' }),
    makeTransaction({ id: 1 }),
  ],
  has_more: false,
}

function api(extra: Record<string, Response | ((body: unknown) => Response)> = {}) {
  return mockApi({
    'GET /api/setup/status': setupDone,
    'GET /api/auth/me': Response.json(makeMe({ parent_unlocked: true })),
    'GET /api/members': Response.json([lena, tom]),
    'GET /api/tasks': Response.json([]),
    'GET /api/today': Response.json(
      makeToday({
        points: [
          { member_id: 1, today: 2, total: 7, week_done: 0 },
          { member_id: 2, today: 0, total: 0, week_done: 0 },
        ],
      }),
    ),
    'GET /api/members/1/points': Response.json(history),
    ...extra,
  })
}

async function openLena() {
  const user = userEvent.setup()
  renderApp('/parents')
  await user.click(await screen.findByRole('button', { name: 'Punkte von Lena' }))
  await screen.findByRole('heading', { name: 'Punkte von Lena', level: 1 })
  return user
}

beforeEach(async () => {
  await i18n.changeLanguage('de')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Punkte im Elternbereich', () => {
  it('zeigt die Punktestände aller Personen', async () => {
    api()
    renderApp('/parents')

    const section = within(
      (await screen.findByRole('heading', { name: 'Punkte' })).closest('section')!,
    )
    expect(await section.findByRole('button', { name: 'Punkte von Lena' })).toHaveTextContent('7')
    expect(section.getByRole('button', { name: 'Punkte von Tom' })).toHaveTextContent('0')
  })

  it('zeigt Punktestand und Buchungshistorie einer Person', async () => {
    api()
    await openLena()

    expect(await screen.findByText('Beim Aufräumen geholfen')).toBeVisible()
    const rows = screen.getAllByRole('listitem').map((row) => row.textContent)
    expect(rows).toEqual([
      expect.stringMatching(/Beim Aufräumen geholfen.*Von Eltern gebucht.*\+5$/),
      expect.stringMatching(/Zähne putzen.*Erledigung zurückgenommen.*−2$/),
      expect.stringMatching(/Zähne putzen.*Aufgabe erledigt.*\+2$/),
    ])
    // Uhrzeit in der Zeitzone der Familie (Berlin, UTC+2), nicht in UTC.
    expect(rows[2]).toContain('07:30')
  })

  it('schreibt Punkte mit Begründung gut', async () => {
    const calls = api({
      'POST /api/members/1/points': Response.json({ ...history, total: 10 }, { status: 201 }),
    })
    const user = await openLena()

    await user.click(screen.getByRole('button', { name: 'Mehr Punkte' }))
    await user.click(screen.getByRole('button', { name: 'Mehr Punkte' }))
    await user.type(screen.getByLabelText('Begründung'), '  Tisch gedeckt ')
    await user.click(screen.getByRole('button', { name: '3 Punkte gutschreiben' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Lena hat 3 Punkte bekommen.')
    const post = calls.find((call) => call.key === 'POST /api/members/1/points')
    expect(post?.body).toEqual({ amount: 3, reason: 'Tisch gedeckt' })
    expect(screen.getByLabelText('Begründung')).toHaveValue('')
  })

  it('zieht Punkte ab und zeigt, wenn nicht genug da sind', async () => {
    const calls = api({
      'POST /api/members/1/points': Response.json({ code: 'points.insufficient' }, { status: 409 }),
    })
    const user = await openLena()

    await user.click(screen.getByRole('radio', { name: 'Abziehen' }))
    await user.type(screen.getByLabelText('Begründung'), 'Streit')
    await user.click(screen.getByRole('button', { name: '1 Punkt abziehen' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'So viele Punkte sind nicht vorhanden.',
    )
    const post = calls.find((call) => call.key === 'POST /api/members/1/points')
    expect(post?.body).toEqual({ amount: -1, reason: 'Streit' })
  })

  it('verlangt eine Begründung', async () => {
    const calls = api()
    const user = await openLena()

    await user.click(screen.getByRole('button', { name: '1 Punkt gutschreiben' }))

    expect(screen.getByLabelText('Begründung')).toHaveAccessibleDescription('Bitte ausfüllen')
    expect(calls.some((call) => call.key.startsWith('POST'))).toBe(false)
  })

  it('lädt ältere Buchungen nach', async () => {
    const firstPage = { ...history, transactions: history.transactions.slice(0, 1), has_more: true }
    const secondPage = { ...history, transactions: history.transactions.slice(1) }
    let page = 0
    api({
      'GET /api/members/1/points': () => Response.json(++page === 1 ? firstPage : secondPage),
    })
    const requested: string[] = []
    const mockedFetch = globalThis.fetch
    vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
      requested.push(String(input))
      return mockedFetch(input, init)
    })
    const user = await openLena()

    await screen.findByText('Beim Aufräumen geholfen')
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Ältere Buchungen laden' }))

    await vi.waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(3))
    expect(requested).toContain('/api/members/1/points?before=3')
    expect(screen.queryByRole('button', { name: 'Ältere Buchungen laden' })).toBeNull()
  })
})
