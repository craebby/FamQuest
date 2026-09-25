import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
import { PERSON_IDLE_TIMEOUT_MS } from './PersonPage'
import { POINTS_FEEDBACK_MS } from './family/TaskCard'
import { COLLAPSE_DELAY_MS } from './family/TaskGroups'

const lena = makeMember({ id: 1, name: 'Lena', color: 'purple' })
const tom = makeMember({ id: 2, name: 'Tom', color: 'green' })

const teeth = makeTodayTask({ id: 10, member_ids: [1, 2] })
const bed = makeTodayTask({
  id: 11,
  title: 'Bett machen',
  icon: 'fluent-emoji-flat:bed',
  points: 1,
  member_ids: [1],
})
const homework = makeTodayTask({
  id: 12,
  title: 'Hausaufgaben',
  icon: 'fluent-emoji-flat:books',
  points: 3,
  time_of_day: 'afternoon',
  member_ids: [2],
})
const anytime = makeTodayTask({
  id: 13,
  title: 'Blumen gießen',
  time_of_day: null,
  member_ids: [1],
})

/** API wie der Server: Erledigungen verändern, was GET /api/today danach liefert. */
const initialPoints = [
  { member_id: 1, today: 0, total: 10, week_done: 0 },
  { member_id: 2, today: 0, total: 0, week_done: 0 },
]

function familyRoutes(
  initial = makeToday({ tasks: [teeth, bed, homework, anytime], points: initialPoints }),
) {
  let today = initial
  const setDone = (taskId: number, memberId: number, done: boolean) => () => {
    const task = today.tasks.find((candidate) => candidate.id === taskId)!
    const delta =
      task.done_member_ids.includes(memberId) === done ? 0 : done ? task.points : -task.points
    today = {
      ...today,
      points: today.points.map((entry) =>
        entry.member_id === memberId
          ? { ...entry, today: entry.today + delta, total: entry.total + delta }
          : entry,
      ),
      tasks: today.tasks.map((task) =>
        task.id !== taskId
          ? task
          : {
              ...task,
              done_member_ids: [
                ...task.done_member_ids.filter((id) => id !== memberId),
                ...(done ? [memberId] : []),
              ],
            },
      ),
    }
    return new Response(null, { status: 204 })
  }
  return {
    'GET /api/setup/status': setupDone,
    'GET /api/auth/me': Response.json(makeMe()),
    'GET /api/members': Response.json([lena, tom]),
    'GET /api/today': () => Response.json(today),
    'GET /api/rewards': Response.json([]),
    'PUT /api/today/tasks/10/members/1': setDone(10, 1, true),
    'DELETE /api/today/tasks/10/members/1': setDone(10, 1, false),
  }
}

function column(name: string) {
  return screen.getByRole('region', { name: `Aufgaben von ${name}` })
}

beforeEach(async () => {
  await i18n.changeLanguage('de')
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('Familienansicht', () => {
  it('zeigt eine Spalte pro Person mit ihren Aufgaben nach Tagesabschnitt', async () => {
    mockApi(familyRoutes())
    renderApp('/')

    expect(
      await screen.findByRole('heading', { name: 'Familie Sonnenschein', level: 1 }),
    ).toBeVisible()
    expect(await screen.findByText('Samstag, 3. Oktober')).toBeVisible()

    const lenaColumn = within(column('Lena'))
    const sections = lenaColumn.getAllByRole('region').map((section) => section.ariaLabel)
    expect(sections).toEqual(['Morgens', 'Jederzeit'])
    expect(lenaColumn.getByRole('button', { name: /Zähne putzen/ })).toHaveAccessibleName(
      'Zähne putzen, 2 Punkte',
    )
    expect(lenaColumn.queryByRole('button', { name: /Hausaufgaben/ })).toBeNull()

    const tomColumn = within(column('Tom'))
    expect(tomColumn.getAllByRole('region').map((section) => section.ariaLabel)).toEqual([
      'Morgens',
      'Nachmittags',
    ])
    // Der aktuelle Tagesabschnitt ist markiert.
    expect(
      within(tomColumn.getByRole('region', { name: 'Morgens' })).getByText('Jetzt'),
    ).toBeVisible()
  })

  it('erledigt eine Aufgabe mit einem Tipp und nimmt sie mit dem nächsten zurück', async () => {
    const user = userEvent.setup()
    const calls = mockApi(familyRoutes())
    renderApp('/')

    const card = await within(
      await screen.findByRole('region', { name: 'Aufgaben von Lena' }),
    ).findByRole('button', { name: /Zähne putzen/ })
    expect(card).toHaveAttribute('aria-pressed', 'false')

    await user.click(card)
    expect(card).toHaveAttribute('aria-pressed', 'true')
    // Tom hat dieselbe Aufgabe, bei ihm bleibt sie offen.
    expect(within(column('Tom')).getByRole('button', { name: /Zähne putzen/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    )

    await user.click(card)
    expect(card).toHaveAttribute('aria-pressed', 'false')

    const writes = calls.filter((call) => call.key.includes('/today/tasks'))
    expect(writes.map((call) => call.key)).toEqual([
      'PUT /api/today/tasks/10/members/1',
      'DELETE /api/today/tasks/10/members/1',
    ])
    expect(writes[0].headers['X-CSRF-Token']).toBe('csrf-123')
  })

  it('zeigt Tagesfortschritt und Punkte unter dem Avatar', async () => {
    mockApi(
      familyRoutes(
        makeToday({
          tasks: [{ ...teeth, done_member_ids: [1] }, bed, homework, anytime],
          points: [
            { member_id: 1, today: 2, total: 12, week_done: 0 },
            { member_id: 2, today: 0, total: 1, week_done: 0 },
          ],
        }),
      ),
    )
    renderApp('/')

    const lenaColumn = within(await screen.findByRole('region', { name: 'Aufgaben von Lena' }))
    expect(lenaColumn.getByRole('img', { name: '1 von 3 Aufgaben erledigt' })).toBeVisible()
    expect(lenaColumn.getByText('Heute 2 Punkte verdient')).toBeInTheDocument()
    expect(lenaColumn.getByText('Insgesamt 12 Punkte')).toBeInTheDocument()

    const tomColumn = within(column('Tom'))
    expect(tomColumn.getByRole('img', { name: '0 von 2 Aufgaben erledigt' })).toBeVisible()
    expect(tomColumn.getByText('Insgesamt 1 Punkt')).toBeInTheDocument()
  })

  it('bucht Punkte sofort und zeigt kurz „+2“', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    mockApi(familyRoutes())
    renderApp('/')

    const lenaColumn = within(await screen.findByRole('region', { name: 'Aufgaben von Lena' }))
    const card = lenaColumn.getByRole('button', { name: /Zähne putzen/ })
    await user.click(card)

    expect(within(card).getByTestId('points-feedback')).toHaveTextContent('+2')
    expect(lenaColumn.getByText('Heute 2 Punkte verdient')).toBeInTheDocument()
    expect(lenaColumn.getByText('Insgesamt 12 Punkte')).toBeInTheDocument()
    expect(lenaColumn.getByRole('img', { name: '1 von 3 Aufgaben erledigt' })).toBeVisible()

    await act(() => vi.advanceTimersByTimeAsync(POINTS_FEEDBACK_MS + 100))
    expect(within(card).queryByTestId('points-feedback')).toBeNull()

    // Rückgängig: Punkte werden abgezogen, ohne „+2“.
    await user.click(card)
    expect(within(card).queryByTestId('points-feedback')).toBeNull()
    expect(lenaColumn.getByText('Heute 0 Punkte verdient')).toBeInTheDocument()
    expect(lenaColumn.getByText('Insgesamt 10 Punkte')).toBeInTheDocument()
  })

  it('sendet das angezeigte Datum mit', async () => {
    const user = userEvent.setup()
    const fetchSpy = vi.fn()
    mockApi(familyRoutes())
    const originalFetch = globalThis.fetch
    vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
      fetchSpy(String(input))
      return originalFetch(input, init)
    })
    renderApp('/')

    await user.click(
      await within(await screen.findByRole('region', { name: 'Aufgaben von Lena' })).findByRole(
        'button',
        { name: /Zähne putzen/ },
      ),
    )

    expect(fetchSpy).toHaveBeenCalledWith('/api/today/tasks/10/members/1?date=2026-10-03')
  })

  it('setzt die Karte bei einem Fehler zurück und zeigt ihn an', async () => {
    const user = userEvent.setup()
    mockApi({
      ...familyRoutes(),
      'PUT /api/today/tasks/10/members/1': Response.json({ code: 'task.not_due' }, { status: 409 }),
    })
    renderApp('/')

    const lenaColumn = within(await screen.findByRole('region', { name: 'Aufgaben von Lena' }))
    const card = lenaColumn.getByRole('button', { name: /Zähne putzen/ })
    await user.click(card)

    expect(await lenaColumn.findByRole('alert')).toHaveTextContent(
      'Diese Aufgabe steht heute nicht an.',
    )
    expect(card).toHaveAttribute('aria-pressed', 'false')
  })

  it('klappt einen erledigten Abschnitt zusammen und wieder auf', async () => {
    const user = userEvent.setup()
    mockApi(
      familyRoutes(
        makeToday({
          tasks: [
            { ...teeth, done_member_ids: [1] },
            { ...bed, done_member_ids: [1] },
          ],
        }),
      ),
    )
    renderApp('/')

    const lenaColumn = within(await screen.findByRole('region', { name: 'Aufgaben von Lena' }))
    expect(lenaColumn.queryByRole('button', { name: /Zähne putzen/ })).toBeNull()

    await user.click(lenaColumn.getByRole('button', { name: 'Morgens: alles erledigt' }))

    expect(lenaColumn.getByRole('button', { name: /Zähne putzen/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('klappt einen gerade fertig gewordenen Abschnitt erst verzögert zu', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    mockApi(familyRoutes(makeToday({ tasks: [{ ...teeth, member_ids: [1] }] })))
    renderApp('/')

    const lenaColumn = within(await screen.findByRole('region', { name: 'Aufgaben von Lena' }))
    await user.click(lenaColumn.getByRole('button', { name: /Zähne putzen/ }))
    expect(lenaColumn.getByRole('button', { name: /Zähne putzen/ })).toBeVisible()

    await act(() => vi.advanceTimersByTimeAsync(COLLAPSE_DELAY_MS + 100))

    expect(lenaColumn.getByRole('button', { name: 'Morgens: alles erledigt' })).toBeVisible()
  })

  it('zeigt „Heute frei“ für Personen ohne Aufgaben', async () => {
    mockApi(familyRoutes(makeToday({ tasks: [homework] })))
    renderApp('/')

    expect(
      await within(await screen.findByRole('region', { name: 'Aufgaben von Lena' })).findByText(
        'Heute frei!',
      ),
    ).toBeVisible()
  })

  it('verweist ohne Familienmitglieder auf den Elternbereich', async () => {
    mockApi({ ...familyRoutes(), 'GET /api/members': Response.json([]) })
    renderApp('/')

    expect(
      await screen.findByRole('heading', { name: 'Noch keine Familienmitglieder' }),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'Zum Elternbereich' })).toHaveAttribute(
      'href',
      '/parents',
    )
  })

  it('zeigt Erwachsenen ihren Anteil an der Woche statt Punkten', async () => {
    const mama = makeMember({ id: 3, name: 'Mama', role: 'parent', color: 'blue' })
    const papa = makeMember({ id: 4, name: 'Papa', role: 'parent', color: 'orange' })
    const cook = makeTodayTask({ id: 20, title: 'Kochen', points: 1, member_ids: [3] })
    mockApi({
      ...familyRoutes(
        makeToday({
          tasks: [cook],
          points: [
            { member_id: 1, today: 0, total: 10, week_done: 3 },
            { member_id: 3, today: 0, total: 0, week_done: 6 },
            { member_id: 4, today: 0, total: 0, week_done: 9 },
          ],
        }),
      ),
      'GET /api/members': Response.json([lena, mama, papa]),
    })
    renderApp('/')

    const mamaColumn = within(await screen.findByRole('region', { name: 'Aufgaben von Mama' }))
    expect(
      mamaColumn.getByRole('img', {
        name: 'Diese Woche 40 % der Aufgaben der Erwachsenen (6 erledigt)',
      }),
    ).toBeVisible()
    expect(mamaColumn.queryByText(/Insgesamt/)).toBeNull()
    // Aufgabenkarten von Erwachsenen zeigen keine Punkte.
    expect(mamaColumn.getByRole('button', { name: 'Kochen' })).toBeVisible()
    expect(within(column('Papa')).getByText('60 %')).toBeInTheDocument()
    // Kinder behalten ihre Punkte.
    expect(within(column('Lena')).getByText('Insgesamt 10 Punkte')).toBeInTheDocument()
  })

  it('hat eine Navigationsleiste mit Heute und Einstellungen', async () => {
    mockApi(familyRoutes())
    renderApp('/')

    const nav = await screen.findByRole('navigation', { name: 'Hauptnavigation' })
    expect(within(nav).getByRole('link', { name: 'Heute' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Einstellungen' })).toHaveAttribute(
      'href',
      '/parents',
    )
  })

  it('funktioniert auch auf Englisch', async () => {
    await i18n.changeLanguage('en')
    mockApi({
      ...familyRoutes(),
      'GET /api/auth/me': Response.json(
        makeMe({ family: { ...makeMe().family, default_language: 'en' } }),
      ),
    })
    renderApp('/')

    const lenaColumn = within(await screen.findByRole('region', { name: "Lena's tasks" }))
    expect(screen.getByText('Saturday, October 3')).toBeVisible()
    expect(lenaColumn.getAllByRole('region').map((section) => section.ariaLabel)).toEqual([
      'Morning',
      'Any time',
    ])
    expect(lenaColumn.getByRole('button', { name: /Bett machen/ })).toHaveAccessibleName(
      'Bett machen, 1 point',
    )
    expect(lenaColumn.getByRole('img', { name: '0 of 3 tasks done' })).toBeVisible()
    expect(lenaColumn.getByText('10 points in total')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Today' })).toBeVisible()
  })
})

describe('Personenansicht', () => {
  it('öffnet sich über den Avatar und führt zurück', async () => {
    const user = userEvent.setup()
    mockApi(familyRoutes())
    renderApp('/')

    await user.click(await screen.findByRole('link', { name: 'Lena öffnen' }))

    expect(await screen.findByRole('heading', { name: 'Lena', level: 1 })).toBeVisible()
    expect(screen.getByRole('button', { name: /Bett machen/ })).toBeVisible()
    expect(screen.getByText('Insgesamt 10 Punkte')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Hausaufgaben/ })).toBeNull()

    await user.click(screen.getByRole('link', { name: 'Zurück zur Familienansicht' }))
    expect(await screen.findByRole('region', { name: 'Aufgaben von Tom' })).toBeVisible()
  })

  it('erledigt Aufgaben wie die Familienansicht', async () => {
    const user = userEvent.setup()
    const calls = mockApi(familyRoutes())
    renderApp('/member/1')

    await user.click(await screen.findByRole('button', { name: /Zähne putzen/ }))

    expect(calls.some((call) => call.key === 'PUT /api/today/tasks/10/members/1')).toBe(true)
  })

  it('kehrt nach Inaktivität zur Familienansicht zurück', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockApi(familyRoutes())
    renderApp('/member/2')
    await screen.findByRole('heading', { name: 'Tom', level: 1 })

    await act(() => vi.advanceTimersByTimeAsync(PERSON_IDLE_TIMEOUT_MS + 100))

    expect(await screen.findByRole('region', { name: 'Aufgaben von Lena' })).toBeVisible()
  })

  it('leitet bei unbekannter Person zur Familienansicht', async () => {
    mockApi(familyRoutes())
    renderApp('/member/99')

    expect(await screen.findByRole('region', { name: 'Aufgaben von Lena' })).toBeVisible()
  })
})
