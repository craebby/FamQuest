import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { TaskWeek, WeekTask } from '../api/taskWeek'
import i18n from '../i18n'
import { makeMe, makeMember, makeToday, mockApi, renderApp, setupDone } from '../test/utils'

beforeEach(async () => {
  await i18n.changeLanguage('de')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const LENA = makeMember()
const TOM = makeMember({ id: 2, name: 'Tom', color: 'green' })

function task(overrides: Partial<WeekTask>): WeekTask {
  return {
    id: 1,
    title: 'Zähne putzen',
    icon: 'fluent-emoji-flat:toothbrush',
    points: 2,
    time_of_day: 'morning',
    color: null,
    extra: false,
    positions: [],
    ...overrides,
  }
}

const dates = ['09-28', '09-29', '09-30', '10-01', '10-02', '10-03', '10-04'].map(
  (date) => `2026-${date}`,
)

const WEEK: TaskWeek = {
  start: '2026-09-28',
  today: '2026-10-03',
  tasks: [
    task({ id: 1, positions: [{ member_id: 1, position: 1 }] }),
    task({ id: 2, title: 'Anziehen', positions: [{ member_id: 1, position: 0 }] }),
    task({ id: 3, title: 'Tisch abräumen', time_of_day: null, extra: true }),
  ],
  days: dates.map((date) => ({
    date,
    entries:
      date === '2026-10-04'
        ? []
        : [
            {
              task_id: 1,
              member_id: 1,
              status: date === '2026-09-29' ? 'open' : 'done',
              done_by: date === '2026-09-29' ? null : 1,
            },
            {
              task_id: 2,
              member_id: 1,
              status: date === '2026-10-03' ? 'pending' : 'done',
              done_by: 1,
            },
            { task_id: 3, member_id: 1, status: 'open', done_by: null },
          ],
  })),
}

function mockWeek() {
  return mockApi({
    'GET /api/setup/status': setupDone,
    'GET /api/auth/me': Response.json(makeMe()),
    'GET /api/members': Response.json([LENA, TOM]),
    'GET /api/today': Response.json(makeToday()),
    'GET /api/tasks/week': Response.json(WEEK),
  })
}

describe('Wochenansicht im Aufgabenbereich', () => {
  it('ist über den Umschalter erreichbar', async () => {
    const user = userEvent.setup()
    mockWeek()
    renderApp('/tasks')

    const views = await screen.findByRole('navigation', { name: 'Ansicht' })
    await user.click(within(views).getByRole('link', { name: 'Woche' }))

    expect(await screen.findByRole('heading', { name: /^28\. September.*4\. Oktober$/, level: 1 }))
    expect(
      within(screen.getByRole('navigation', { name: 'Hauptnavigation' })).getByRole('link', {
        name: 'Aufgaben',
      }),
    ).toHaveAttribute('aria-current', 'page')
  })

  it('zeigt je Tag die Aufgaben mit Status in der Reihenfolge der Routine', async () => {
    mockWeek()
    renderApp('/tasks/week')

    const tuesday = within(await screen.findByRole('region', { name: 'Dienstag, 29. September' }))
    expect(tuesday.getAllByRole('listitem').map((item) => item.getAttribute('aria-label'))).toEqual(
      ['Anziehen: erledigt', 'Zähne putzen: nicht erledigt', 'Tisch abräumen: nicht erledigt'],
    )
    // Extras zählen nicht mit.
    expect(tuesday.getByText('1 von 2 Aufgaben erledigt')).toBeInTheDocument()

    const today = screen.getByRole('region', { name: 'Samstag, 3. Oktober' })
    expect(today).toHaveAttribute('aria-current', 'date')
    expect(within(today).getByRole('listitem', { name: 'Anziehen: wartet auf Kontrolle' }))
    expect(within(today).getByRole('listitem', { name: 'Tisch abräumen: kommt noch' }))

    const sunday = within(screen.getByRole('region', { name: 'Sonntag, 4. Oktober' }))
    expect(sunday.getByText('Frei')).toBeVisible()
    // Tom hat keine Aufgaben und erscheint nicht.
    expect(screen.queryByText('Tom')).toBeNull()
  })

  it('blättert zur nächsten Woche', async () => {
    const user = userEvent.setup()
    const calls = mockWeek()
    renderApp('/tasks/week')

    await user.click(await screen.findByRole('button', { name: 'Nächste Woche' }))

    expect(await screen.findByRole('button', { name: 'Diese Woche' })).toBeVisible()
    expect(calls.filter((call) => call.key === 'GET /api/tasks/week').length).toBeGreaterThan(1)
  })
})
