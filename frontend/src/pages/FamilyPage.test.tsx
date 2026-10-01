import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import i18n from '../i18n'
import {
  makeChore,
  makeChorePlan,
  makeTodo,
  makeMe,
  makeMember,
  makeToday,
  makeTodayTask,
  mockApi,
  renderApp,
  setupDone,
} from '../test/utils'
import { PERSON_IDLE_TIMEOUT_MS } from './PersonPage'
import { POINTS_FEEDBACK_MS } from './family/useTaskToggle'
import { COLLAPSE_DELAY_MS } from './family/TaskGroups'

const lena = makeMember({ id: 1, name: 'Lena', color: 'purple' })
const tom = makeMember({ id: 2, name: 'Tom', color: 'green' })
const mama = makeMember({ id: 3, name: 'Mama', role: 'parent', color: 'blue' })
const papa = makeMember({ id: 4, name: 'Papa', role: 'parent', color: 'orange' })

const bathroom = makeChore({
  id: 1,
  title: 'Bad putzen',
  interval_days: 7,
  days_left: -2,
  ratio: 1.29,
  level: 'due',
})
const householdPlan = makeChorePlan({
  rooms: [{ id: 1, name: 'Bad oben', icon: 'fluent-emoji-flat:bathtub' }],
  chores: [
    bathroom,
    makeChore({ id: 2, title: 'Staubsaugen', days_left: 2, ratio: 0.71, level: 'soon' }),
    makeChore({ id: 3, title: 'Fenster putzen', interval_days: 180, days_left: 150 }),
    makeChore({ id: 4, title: 'Rasen mähen', level: 'due', active: false }),
  ],
  shares: [
    { member_id: 3, count: 6 },
    { member_id: 4, count: 9 },
  ],
})

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
  { member_id: 1, today: 0, total: 10 },
  { member_id: 2, today: 0, total: 0 },
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
    renderApp('/tasks')

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
    renderApp('/tasks')

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
            { member_id: 1, today: 2, total: 12 },
            { member_id: 2, today: 0, total: 1 },
          ],
        }),
      ),
    )
    renderApp('/tasks')

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
    renderApp('/tasks')

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
    renderApp('/tasks')

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
    renderApp('/tasks')

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
    renderApp('/tasks')

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
    renderApp('/tasks')

    const lenaColumn = within(await screen.findByRole('region', { name: 'Aufgaben von Lena' }))
    await user.click(lenaColumn.getByRole('button', { name: /Zähne putzen/ }))
    expect(lenaColumn.getByRole('button', { name: /Zähne putzen/ })).toBeVisible()

    await act(() => vi.advanceTimersByTimeAsync(COLLAPSE_DELAY_MS + 100))

    expect(lenaColumn.getByRole('button', { name: 'Morgens: alles erledigt' })).toBeVisible()
  })

  it('zeigt „Heute frei“ für Personen ohne Aufgaben', async () => {
    mockApi(familyRoutes(makeToday({ tasks: [homework] })))
    renderApp('/tasks')

    expect(
      await within(await screen.findByRole('region', { name: 'Aufgaben von Lena' })).findByText(
        'Heute frei!',
      ),
    ).toBeVisible()
  })

  it('verweist ohne Familienmitglieder auf den Elternbereich', async () => {
    mockApi({ ...familyRoutes(), 'GET /api/members': Response.json([]) })
    renderApp('/tasks')

    expect(
      await screen.findByRole('heading', { name: 'Noch keine Familienmitglieder' }),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'Zum Elternbereich' })).toHaveAttribute(
      'href',
      '/parents/family',
    )
  })

  it('zeigt statt der Erwachsenen den Haushalt als Spalte: nur was rot oder gelb ist', async () => {
    mockApi({
      ...familyRoutes(),
      'GET /api/members': Response.json([lena, mama, papa]),
      'GET /api/chores': Response.json(householdPlan),
    })
    renderApp('/tasks')

    const household = within(await screen.findByRole('region', { name: 'Haushalt' }))
    expect(screen.getByRole('region', { name: 'Aufgaben von Lena' })).toBeVisible()
    expect(screen.queryByRole('region', { name: 'Aufgaben von Mama' })).toBeNull()

    const due = within(household.getByRole('region', { name: 'Jetzt dran' }))
    expect(
      due.getByRole('button', { name: /Bad putzen.*Bad oben.*Seit 2 Tagen fällig/ }),
    ).toBeVisible()
    const soon = within(household.getByRole('region', { name: 'Bald dran' }))
    expect(soon.getByRole('button', { name: /Staubsaugen/ })).toBeVisible()
    // Grünes und Pausiertes steht nur in der Ansicht „Haushalt“.
    expect(household.queryByRole('button', { name: /Fenster putzen/ })).toBeNull()
    expect(household.queryByRole('button', { name: /Rasen mähen/ })).toBeNull()
    // Faire Verteilung aus „Wer war's?“ im Putzplan.
    expect(
      household.getByRole('img', {
        name: 'Wer hat’s gemacht? (letzte 30 Tage): Mama: 40 % (6-mal); Papa: 60 % (9-mal)',
      }),
    ).toBeVisible()
    expect(household.getByRole('link', { name: 'Haushalt öffnen' })).toHaveAttribute(
      'href',
      '/household',
    )
  })

  it('erledigt Hausarbeit mit einem Tipp und fragt, wer es war', async () => {
    const user = userEvent.setup()
    let plan = householdPlan
    const calls = mockApi({
      ...familyRoutes(),
      'GET /api/members': Response.json([lena, mama, papa]),
      'GET /api/chores': () => Response.json(plan),
      'PUT /api/chores/1/done': (body) => {
        const done = {
          ...bathroom,
          done_today: true,
          done_by: (body as { member_id: number | null }).member_id,
          level: 'ok' as const,
        }
        plan = { ...plan, chores: plan.chores.map((chore) => (chore.id === 1 ? done : chore)) }
        return Response.json(done)
      },
    })
    renderApp('/tasks')

    const household = within(await screen.findByRole('region', { name: 'Haushalt' }))
    await user.click(household.getByRole('button', { name: /Bad putzen/ }))

    const who = within(await screen.findByRole('region', { name: 'Wer war’s?' }))
    await user.click(who.getByRole('button', { name: 'Mama' }))

    const writes = calls.filter((call) => call.key === 'PUT /api/chores/1/done')
    expect(writes.map((call) => call.body)).toEqual([{ member_id: null }, { member_id: 3 }])
    const finished = within(await household.findByRole('region', { name: 'Heute erledigt' }))
    expect(finished.getByRole('button', { name: /Bad putzen/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(finished.getByRole('img', { name: 'Erledigt von Mama' })).toBeVisible()
  })

  it('zeigt in der Haushalt-Spalte oben, was zu erledigen ist, auch ohne Putzplan', async () => {
    const user = userEvent.setup()
    const feed = makeTodo({ id: 7 })
    let plan = makeChorePlan({
      todos: [feed, makeTodo({ id: 8, title: 'Glühbirne wechseln', done: true, done_by: 3 })],
    })
    const calls = mockApi({
      ...familyRoutes(),
      'GET /api/members': Response.json([lena, mama, papa]),
      'GET /api/chores': () => Response.json(plan),
      'PUT /api/todos/7/done': (body) => {
        const done = { ...feed, done: true, done_by: (body as { member_id: number }).member_id }
        plan = { ...plan, todos: plan.todos.map((todo) => (todo.id === 7 ? done : todo)) }
        return Response.json(done)
      },
    })
    renderApp('/tasks')

    const household = within(await screen.findByRole('region', { name: 'Haushalt' }))
    const todos = within(household.getByRole('region', { name: 'Zu erledigen' }))
    const finished = within(household.getByRole('region', { name: 'Heute erledigt' }))
    expect(finished.getByRole('button', { name: /Glühbirne wechseln/ })).toBeVisible()
    expect(finished.getByRole('img', { name: 'Erledigt von Mama' })).toBeVisible()
    expect(household.queryByText('Alles im grünen Bereich')).toBeNull()

    await user.click(todos.getByRole('button', { name: 'Hühnerfutter holen' }))
    const who = within(await screen.findByRole('region', { name: 'Wer war’s?' }))
    await user.click(who.getByRole('button', { name: 'Papa' }))

    const writes = calls.filter((call) => call.key === 'PUT /api/todos/7/done')
    expect(writes.map((call) => call.body)).toEqual([{ member_id: null }, { member_id: 4 }])
    expect(await finished.findByRole('button', { name: /Hühnerfutter holen/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(household.queryByRole('region', { name: 'Zu erledigen' })).toBeNull()
  })

  it('zeigt ohne Kinder nur den Haushalt, ohne beides den Weg in den Elternbereich', async () => {
    mockApi({
      ...familyRoutes(),
      'GET /api/members': Response.json([mama, papa]),
      'GET /api/chores': Response.json(householdPlan),
    })
    const view = renderApp('/tasks')
    expect(await screen.findByRole('region', { name: 'Haushalt' })).toBeVisible()
    view.unmount()

    mockApi({ ...familyRoutes(), 'GET /api/members': Response.json([mama, papa]) })
    renderApp('/tasks')
    expect(await screen.findByRole('heading', { name: 'Noch keine Aufgaben' })).toBeVisible()
  })

  it('zeigt flexible Aufgaben überfällig oder unter „Demnächst“', async () => {
    const bath = makeTodayTask({
      id: 30,
      title: 'Bad putzen',
      time_of_day: null,
      due_dates: [{ member_id: 1, due_date: '2026-09-30' }],
    })
    const plants = makeTodayTask({
      id: 31,
      title: 'Blumen gießen',
      time_of_day: null,
      due_dates: [{ member_id: 1, due_date: '2026-10-05' }],
    })
    mockApi(familyRoutes(makeToday({ tasks: [teeth, bath, plants], points: initialPoints })))
    renderApp('/tasks')

    const lenaColumn = within(await screen.findByRole('region', { name: 'Aufgaben von Lena' }))
    expect(
      lenaColumn.getByRole('button', { name: 'Bad putzen, 2 Punkte, seit 3 Tagen fällig' }),
    ).toBeVisible()
    const soon = within(lenaColumn.getByRole('region', { name: 'Demnächst' }))
    expect(
      soon.getByRole('button', { name: 'Blumen gießen, 2 Punkte, in 2 Tagen fällig' }),
    ).toBeVisible()
    // „Demnächst“ zählt nicht zum Tagesfortschritt.
    expect(lenaColumn.getByRole('img', { name: '0 von 2 Aufgaben erledigt' })).toBeVisible()
  })

  it('zeigt „Einer für alle“ bei allen als erledigt, mit Avatar', async () => {
    const table = makeTodayTask({
      id: 30,
      title: 'Tisch decken',
      member_ids: [1, 2],
      shared: true,
      done_member_ids: [2],
    })
    mockApi(
      // Eine offene Aufgabe, damit der Abschnitt nicht zuklappt.
      familyRoutes(
        makeToday({
          tasks: [table, makeTodayTask({ id: 31, title: 'Anziehen', member_ids: [1, 2] })],
        }),
      ),
    )
    renderApp('/tasks')

    const lenaColumn = within(await screen.findByRole('region', { name: 'Aufgaben von Lena' }))
    const card = lenaColumn.getByRole('button', {
      name: 'Tisch decken, 2 Punkte, erledigt von Tom',
    })
    expect(card).toHaveAttribute('aria-pressed', 'true')
    expect(within(card).getByTestId('done-by')).toBeInTheDocument()
    expect(
      within(column('Tom')).getByRole('button', { name: 'Tisch decken, 2 Punkte' }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('hat eine Navigationsleiste mit Heute, Aufgaben und Einstellungen', async () => {
    mockApi(familyRoutes())
    renderApp('/tasks')

    const nav = await screen.findByRole('navigation', { name: 'Hauptnavigation' })
    expect(within(nav).getByRole('link', { name: 'Heute' })).toHaveAttribute('href', '/')
    expect(within(nav).getByRole('link', { name: 'Aufgaben' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(nav).getByRole('link', { name: 'Einstellungen' })).toHaveAttribute(
      'href',
      '/parents',
    )
  })

  it('zeigt Routinen in der festgelegten Reihenfolge und Extras als eigenen Block', async () => {
    const first = makeTodayTask({
      id: 20,
      title: 'Anziehen',
      member_ids: [1],
      positions: [{ member_id: 1, position: 0 }],
    })
    const second = makeTodayTask({
      id: 21,
      title: 'Kuscheltier einpacken',
      member_ids: [1],
      positions: [{ member_id: 1, position: 1 }],
    })
    const extra = makeTodayTask({
      id: 22,
      title: 'Tisch abräumen',
      time_of_day: null,
      extra: true,
      member_ids: [1],
    })
    mockApi(familyRoutes(makeToday({ tasks: [extra, second, first] })))
    renderApp('/tasks')

    const column = within(await screen.findByRole('region', { name: 'Aufgaben von Lena' }))
    const morning = within(column.getByRole('region', { name: 'Morgens' }))
    expect(
      morning.getAllByRole('button', { pressed: false }).map((card) => card.textContent),
    ).toEqual([expect.stringContaining('Anziehen'), expect.stringContaining('Kuscheltier')])
    expect(
      within(column.getByRole('region', { name: 'Extras' })).getByRole('button', {
        name: /^Tisch abräumen/,
      }),
    ).toBeVisible()
    // Extras zählen nicht zum Tagesfortschritt.
    expect(column.getByRole('img', { name: '0 von 2 Aufgaben erledigt' })).toBeInTheDocument()
  })

  it('zeigt optionale Routinenschritte im Block, ohne sie mitzuzählen', async () => {
    const dress = makeTodayTask({
      id: 20,
      title: 'Anziehen',
      member_ids: [1],
      positions: [{ member_id: 1, position: 0, optional: false }],
    })
    const teddy = makeTodayTask({
      id: 21,
      title: 'Kuscheltier',
      member_ids: [1],
      positions: [{ member_id: 1, position: 1, optional: true }],
      done_member_ids: [],
    })
    mockApi(familyRoutes(makeToday({ tasks: [teddy, dress] })))
    renderApp('/tasks')

    const column = within(await screen.findByRole('region', { name: 'Aufgaben von Lena' }))
    const morning = within(column.getByRole('region', { name: 'Morgens' }))
    expect(
      morning
        .getAllByRole('button', { pressed: false })
        .map((card) => card.getAttribute('aria-label')),
    ).toEqual(['Anziehen, 2 Punkte', 'Kuscheltier, 2 Punkte, optional'])
    expect(column.getByRole('img', { name: '0 von 1 Aufgaben erledigt' })).toBeInTheDocument()
  })

  it('funktioniert auch auf Englisch', async () => {
    await i18n.changeLanguage('en')
    mockApi({
      ...familyRoutes(),
      'GET /api/auth/me': Response.json(
        makeMe({ family: { ...makeMe().family, default_language: 'en' } }),
      ),
    })
    renderApp('/tasks')

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
    renderApp('/tasks')

    await user.click(await screen.findByRole('link', { name: 'Lena öffnen' }))

    expect(await screen.findByRole('heading', { name: 'Lena', level: 1 })).toBeVisible()
    expect(screen.getByRole('button', { name: /Bett machen/ })).toBeVisible()
    expect(screen.getByText('Insgesamt 10 Punkte')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Hausaufgaben/ })).toBeNull()

    await user.click(screen.getByRole('link', { name: 'Zurück' }))
    expect(await screen.findByRole('region', { name: 'Aufgaben von Tom' })).toBeVisible()
  })

  it('erledigt Aufgaben wie die Familienansicht', async () => {
    const user = userEvent.setup()
    const calls = mockApi(familyRoutes())
    renderApp('/member/1')

    await user.click(await screen.findByRole('button', { name: /Zähne putzen/ }))

    expect(calls.some((call) => call.key === 'PUT /api/today/tasks/10/members/1')).toBe(true)
  })

  it('kehrt nach Inaktivität zur Startseite zurück', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockApi(familyRoutes())
    renderApp('/member/2')
    await screen.findByRole('heading', { name: 'Tom', level: 1 })

    await act(() => vi.advanceTimersByTimeAsync(PERSON_IDLE_TIMEOUT_MS + 100))

    expect(await screen.findByRole('link', { name: 'Alle Aufgaben öffnen' })).toBeVisible()
  })

  it('leitet bei unbekannter Person zur Familienansicht', async () => {
    mockApi(familyRoutes())
    renderApp('/member/99')

    expect(await screen.findByRole('region', { name: 'Aufgaben von Lena' })).toBeVisible()
  })
})
