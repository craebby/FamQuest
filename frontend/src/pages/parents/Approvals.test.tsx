import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Approval } from '../../api/approvals'
import i18n from '../../i18n'
import {
  makeMe,
  makeMember,
  makeToday,
  makeTodayTask,
  mockApi,
  renderApp,
  setupDone,
} from '../../test/utils'

const lena = makeMember()
const tom = makeMember({ id: 2, name: 'Tom', color: 'green' })

function makeApproval(overrides: Partial<Approval> = {}): Approval {
  return {
    id: 7,
    task_id: 20,
    title: 'Zimmer aufräumen',
    icon: 'fluent-emoji-flat:teddy-bear',
    points: 5,
    member_id: 1,
    date: '2026-10-03',
    completed_at: '2026-10-03T15:00:00Z',
    ...overrides,
  }
}

function parentsApi(approvals: Approval[], extra: Record<string, Response> = {}) {
  return mockApi({
    'GET /api/setup/status': setupDone,
    'GET /api/auth/me': Response.json(makeMe({ parent_unlocked: true })),
    'GET /api/members': Response.json([lena, tom]),
    'GET /api/tasks': Response.json([]),
    'GET /api/rewards': Response.json([]),
    'GET /api/today': Response.json(makeToday({ pending_approvals: approvals.length })),
    'GET /api/approvals': Response.json(approvals),
    'POST /api/approvals/7': new Response(null, { status: 204 }),
    'POST /api/approvals/8': new Response(null, { status: 204 }),
    'DELETE /api/approvals/7': new Response(null, { status: 204 }),
    ...extra,
  })
}

function section() {
  return within(screen.getByRole('heading', { name: 'Zu prüfen' }).parentElement!)
}

beforeEach(async () => {
  await i18n.changeLanguage('de')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Kontrolle durch die Eltern', () => {
  it('bestätigt oder lehnt Erledigungen ab', async () => {
    const user = userEvent.setup()
    const calls = parentsApi([
      makeApproval(),
      makeApproval({ id: 8, member_id: 2, date: '2026-10-02', points: 3 }),
    ])
    renderApp('/parents')

    await screen.findByRole('heading', { name: 'Zu prüfen' })
    // Erledigungen früherer Tage zeigen ihr Datum.
    expect(section().getByText('Freitag, 2. Oktober')).toBeVisible()

    await user.click(
      section().getByRole('button', { name: 'Zimmer aufräumen von Lena bestätigen' }),
    )
    await user.click(section().getByRole('button', { name: 'Zimmer aufräumen von Lena ablehnen' }))

    expect(calls.map((call) => call.key)).toEqual(
      expect.arrayContaining(['POST /api/approvals/7', 'DELETE /api/approvals/7']),
    )
    await user.click(section().getByRole('button', { name: 'Alle 2 bestätigen' }))
    expect(calls.filter((call) => call.key === 'POST /api/approvals/8')).toHaveLength(1)
  })

  it('bleibt ohne wartende Erledigungen unsichtbar', async () => {
    parentsApi([])
    renderApp('/parents')

    await screen.findByRole('heading', { name: 'Aufgaben' })
    expect(screen.queryByRole('heading', { name: 'Zu prüfen' })).toBeNull()
  })

  it('übernimmt „Eltern prüfen“ aus der Vorlage', async () => {
    const user = userEvent.setup()
    const calls = parentsApi([], {
      'POST /api/tasks': Response.json({}, { status: 201 }),
    })
    renderApp('/parents')

    await user.click(await screen.findByRole('button', { name: 'Aufgabe hinzufügen' }))
    await user.click(screen.getByRole('button', { name: 'Aus Vorlagen wählen' }))
    await user.click(screen.getByRole('button', { name: /Spielzeug aufräumen/ }))
    expect(screen.getByRole('switch', { name: 'Eltern prüfen' })).toBeChecked()
    await user.click(screen.getByRole('checkbox', { name: /Lena/ }))
    await user.click(screen.getByRole('button', { name: 'Speichern' }))

    await vi.waitFor(() =>
      expect(calls.find((call) => call.key === 'POST /api/tasks')?.body).toMatchObject({
        needs_approval: true,
      }),
    )
  })
})

describe('Aufgaben mit Kontrolle am Display', () => {
  it('wartet nach dem Antippen auf die Eltern, ohne Punkte zu buchen', async () => {
    const user = userEvent.setup()
    const room = makeTodayTask({
      id: 20,
      title: 'Zimmer aufräumen',
      points: 5,
      needs_approval: true,
    })
    let today = makeToday({
      tasks: [room],
      points: [{ member_id: 1, today: 0, total: 10, week_done: 0 }],
    })
    mockApi({
      'GET /api/setup/status': setupDone,
      'GET /api/auth/me': Response.json(makeMe()),
      'GET /api/members': Response.json([lena]),
      'GET /api/today': () => Response.json(today),
      'PUT /api/today/tasks/20/members/1': () => {
        today = {
          ...today,
          tasks: [{ ...room, done_member_ids: [1], pending_member_ids: [1] }],
          pending_approvals: 1,
        }
        return new Response(null, { status: 204 })
      },
    })
    renderApp('/')

    await user.click(await screen.findByRole('button', { name: 'Zimmer aufräumen, 5 Punkte' }))

    const card = await screen.findByRole('button', {
      name: 'Zimmer aufräumen, 5 Punkte, wartet auf Kontrolle',
    })
    expect(card).toHaveAttribute('aria-pressed', 'true')
    expect(within(card).getByTestId('pending-badge')).toBeInTheDocument()
    expect(screen.getByText('Insgesamt 10 Punkte')).toBeInTheDocument()
    expect(
      await screen.findByRole('link', { name: 'Einstellungen, 1 Aufgabe wartet auf Kontrolle' }),
    ).toBeVisible()
  })
})
