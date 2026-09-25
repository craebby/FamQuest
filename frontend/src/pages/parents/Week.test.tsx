import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Week } from '../../api/week'
import i18n from '../../i18n'
import { makeMe, makeMember, makeToday, mockApi, renderApp, setupDone } from '../../test/utils'
import { addDays } from '../../weekdays'

const lena = makeMember()

function makeWeek(start: string, counts: [number, number][]): Week {
  return {
    start,
    today: '2026-10-03',
    members: [
      {
        member_id: 1,
        days: counts.map(([planned, done], index) => ({
          date: addDays(start, index),
          planned,
          done,
        })),
      },
    ],
  }
}

beforeEach(async () => {
  await i18n.changeLanguage('de')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Wochenübersicht', () => {
  it('zeigt je Tag, wie viel erledigt ist, und blättert', async () => {
    const user = userEvent.setup()
    // Die angefragte Woche steht in der URL des gerade laufenden fetch-Aufrufs.
    const fetchUrl = () => String(vi.mocked(fetch).mock.lastCall?.[0] ?? '')
    mockApi({
      'GET /api/setup/status': setupDone,
      'GET /api/auth/me': Response.json(makeMe({ parent_unlocked: true })),
      'GET /api/members': Response.json([lena]),
      'GET /api/tasks': Response.json([]),
      'GET /api/rewards': Response.json([]),
      'GET /api/approvals': Response.json([]),
      'GET /api/today': Response.json(makeToday()),
      'GET /api/week': () =>
        Response.json(
          fetchUrl().includes('start=2026-09-21')
            ? makeWeek('2026-09-21', [[2, 2], ...Array(6).fill([2, 1])])
            : makeWeek('2026-09-28', [
                [2, 2],
                [2, 1],
                [2, 0],
                [2, 2],
                [2, 2],
                [1, 0],
                [0, 0],
              ]),
        ),
    })
    renderApp('/parents')

    const section = within(
      (await screen.findByRole('heading', { name: 'Woche', level: 2 })).parentElement!,
    )
    expect(section.getByText('28. Sept. – 4. Okt.')).toBeVisible()
    expect(
      section.getByRole('img', { name: 'Montag, 28. September: 2 von 2 Aufgaben erledigt' }),
    ).toBeVisible()
    expect(
      section.getByRole('img', { name: 'Dienstag, 29. September: 1 von 2 Aufgaben erledigt' }),
    ).toBeVisible()
    expect(section.getByText('Diese Woche 7 von 11 Aufgaben erledigt')).toBeInTheDocument()

    await user.click(section.getByRole('button', { name: 'Vorherige Woche' }))
    expect(await section.findByText('21. Sept. – 27. Sept.')).toBeVisible()
    expect(fetchUrl()).toContain('/api/week?start=2026-09-21')
    await user.click(section.getByRole('button', { name: 'Diese Woche' }))
    expect(await section.findByText('28. Sept. – 4. Okt.')).toBeVisible()
  })
})
