import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Member } from '../../api/members'
import type { Routine } from '../../api/routines'
import type { Task } from '../../api/tasks'
import i18n from '../../i18n'
import { makeMe, makeMember, mockApi, renderApp, setupDone } from '../../test/utils'

const lena = makeMember()
const tom = makeMember({ id: 2, name: 'Tom', color: 'green' })
const mama = makeMember({ id: 3, name: 'Mama', role: 'parent', color: 'blue' })

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    title: 'Zähne putzen',
    icon: 'fluent-emoji-flat:toothbrush',
    description: '',
    points: 2,
    time_of_day: 'morning',
    color: null,
    active: true,
    needs_approval: false,
    shared: false,
    extra: false,
    recurrence: { kind: 'daily' },
    member_ids: [1],
    positions: [{ member_id: 1, position: 0 }],
    routine_member_ids: [1],
    ...overrides,
  }
}

function makeRoutine(overrides: Partial<Routine> = {}): Routine {
  return {
    id: 1,
    member_id: 1,
    time_of_day: 'morning',
    weekdays: [1, 2, 3, 4, 5],
    steps: [],
    ...overrides,
  }
}

const TASKS = [
  makeTask({ id: 1, title: 'Zähne putzen', points: 2 }),
  makeTask({ id: 2, title: 'Anziehen', icon: 'fluent-emoji-flat:t-shirt', points: 3 }),
  makeTask({ id: 3, title: 'Kuscheltier', icon: 'fluent-emoji-flat:teddy-bear', points: 1 }),
  makeTask({ id: 4, title: 'Schlafanzug', time_of_day: 'evening' }),
]

const WEEKDAY_MORNING = makeRoutine({
  steps: [
    { task_id: 1, optional: false },
    { task_id: 2, optional: false },
    { task_id: 3, optional: true },
  ],
})

type Handler = Response | ((body: unknown) => Response)

function api(
  routines: Routine[],
  extra: Record<string, Handler> = {},
  members: Member[] = [lena, tom, mama],
) {
  return mockApi({
    'GET /api/setup/status': setupDone,
    'GET /api/auth/me': Response.json(makeMe({ parent_unlocked: true })),
    'GET /api/members': Response.json(members),
    'GET /api/tasks': Response.json(TASKS),
    'GET /api/routines': Response.json(routines),
    ...extra,
  })
}

async function section() {
  return within(await screen.findByRole('region', { name: 'Routinen' }))
}

/** Karte einer Routine-Version, benannt nach ihren Tagen. */
async function card(time: string, days: string) {
  const block = within(await (await section()).findByRole('region', { name: time }))
  return within(await block.findByRole('article', { name: days }))
}

const stepTitles = (scope: ReturnType<typeof within>) =>
  scope
    .queryAllByRole('button', { name: /bearbeiten$/ })
    .map((button: HTMLElement) => button.getAttribute('aria-label')?.replace(' bearbeiten', ''))

const bodyOf = (calls: { key: string; body: unknown }[], key: string) =>
  calls.filter((call) => call.key === key).at(-1)?.body

beforeEach(async () => {
  await i18n.changeLanguage('de')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Routinen im Elternbereich', () => {
  it('bittet zuerst um ein Kind', async () => {
    api([], {}, [mama])
    renderApp('/parents/routines')

    expect((await section()).getByText(/Legt zuerst ein Kind an/)).toBeVisible()
  })

  it('zeigt das gewählte Kind auch, wenn es nur eines gibt', async () => {
    api([], {}, [lena, mama])
    renderApp('/parents/routines')

    const children = await (await section()).findByRole('group', { name: 'Kind wählen' })
    expect(within(children).getByRole('button', { name: /Lena/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('zeigt je Tagesabschnitt die Versionen mit nummerierten Schritten', async () => {
    const user = userEvent.setup()
    api([
      WEEKDAY_MORNING,
      makeRoutine({ id: 2, weekdays: [6], steps: [{ task_id: 2, optional: false }] }),
      makeRoutine({ id: 3, member_id: 2, weekdays: [1, 2, 3, 4, 5, 6, 7] }),
    ])
    renderApp('/parents/routines')

    const weekdays = await card('Morgens', 'Montag bis Freitag')
    expect(stepTitles(weekdays)).toEqual(['Zähne putzen', 'Anziehen', 'Kuscheltier'])
    // Optionale Schritte zählen nicht mit.
    expect(weekdays.getByText('2 Schritte')).toBeVisible()
    expect(weekdays.getByText('5 Punkte')).toBeInTheDocument()
    expect(weekdays.getByRole('button', { name: 'Kuscheltier optional' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    const days = weekdays.getByRole('group', { name: /^Tage für Lena · Morgens/ })
    expect(within(days).getByRole('button', { name: 'Montag' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(within(days).getByRole('button', { name: 'Samstag' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )

    const s = await section()
    expect(stepTitles(await card('Morgens', 'Sa'))).toEqual(['Anziehen'])
    expect(
      within(s.getByRole('region', { name: 'Morgens' })).getByText('Ohne Routine an: So'),
    ).toBeVisible()
    // Ohne Routine: anlegen; „Mittags“ erscheint nur, wenn es dort eine gibt.
    expect(
      within(s.getByRole('region', { name: 'Nachmittags' })).getByRole('button', {
        name: 'Routine anlegen',
      }),
    ).toBeVisible()
    expect(s.queryByRole('region', { name: 'Mittags' })).toBeNull()

    await user.click(
      within(s.getByRole('group', { name: 'Kind wählen' })).getByRole('button', { name: /Tom/ }),
    )
    expect(stepTitles(await card('Morgens', 'Täglich'))).toEqual([])
  })

  it('sortiert, markiert optional und nimmt Schritte heraus', async () => {
    const user = userEvent.setup()
    let current = [WEEKDAY_MORNING]
    const calls = api(current, {
      'GET /api/routines': () => Response.json(current),
      'PUT /api/routines/1/steps': (body) => {
        const { steps } = body as { steps: Routine['steps'] }
        current = [{ ...WEEKDAY_MORNING, steps }]
        return Response.json(current[0])
      },
    })
    renderApp('/parents/routines')

    const morning = await card('Morgens', 'Montag bis Freitag')
    expect(morning.getByRole('button', { name: 'Zähne putzen nach oben' })).toBeDisabled()
    await user.click(morning.getByRole('button', { name: 'Anziehen nach oben' }))
    expect(bodyOf(calls, 'PUT /api/routines/1/steps')).toEqual({
      steps: [
        { task_id: 2, optional: false },
        { task_id: 1, optional: false },
        { task_id: 3, optional: true },
      ],
    })
    // Sofort in der neuen Reihenfolge.
    expect(stepTitles(morning)).toEqual(['Anziehen', 'Zähne putzen', 'Kuscheltier'])

    await user.click(morning.getByRole('button', { name: 'Kuscheltier optional' }))
    expect(bodyOf(calls, 'PUT /api/routines/1/steps')).toMatchObject({
      steps: [{}, {}, { task_id: 3, optional: false }],
    })

    await user.click(morning.getByRole('button', { name: 'Zähne putzen aus der Routine nehmen' }))
    expect(bodyOf(calls, 'PUT /api/routines/1/steps')).toEqual({
      steps: [
        { task_id: 2, optional: false },
        { task_id: 3, optional: false },
      ],
    })
  })

  it('verschiebt Tage und legt eine Version für andere Tage an', async () => {
    const user = userEvent.setup()
    const everyday = makeRoutine({ weekdays: [1, 2, 3, 4, 5, 6, 7], steps: WEEKDAY_MORNING.steps })
    const calls = api([everyday], {
      'PUT /api/routines/1/days': Response.json([everyday]),
      'POST /api/routines': Response.json(makeRoutine({ id: 9 }), { status: 201 }),
    })
    renderApp('/parents/routines')

    const morning = await card('Morgens', 'Täglich')
    await user.click(
      within(morning.getByRole('group', { name: /^Tage für/ })).getByRole('button', {
        name: 'Mittwoch',
      }),
    )
    expect(bodyOf(calls, 'PUT /api/routines/1/days')).toEqual({ weekdays: [1, 2, 4, 5, 6, 7] })

    // Alle Tage belegt: Die neue Version bekommt das Wochenende und die Schritte als Vorlage.
    const block = within((await section()).getByRole('region', { name: 'Morgens' }))
    await user.click(block.getByRole('button', { name: 'Andere Tage anders' }))
    expect(bodyOf(calls, 'POST /api/routines')).toEqual({
      member_id: 1,
      time_of_day: 'morning',
      weekdays: [6, 7],
      copy_from: 1,
    })

    const afternoon = within((await section()).getByRole('region', { name: 'Nachmittags' }))
    await user.click(afternoon.getByRole('button', { name: 'Routine anlegen' }))
    expect(bodyOf(calls, 'POST /api/routines')).toEqual({
      member_id: 1,
      time_of_day: 'afternoon',
      weekdays: [1, 2, 3, 4, 5, 6, 7],
    })
  })

  it('übernimmt einen vorhandenen Schritt', async () => {
    const user = userEvent.setup()
    const routine = makeRoutine({ steps: [{ task_id: 1, optional: false }] })
    const calls = api([routine], {
      'POST /api/routines/1/steps': Response.json(routine, { status: 201 }),
    })
    renderApp('/parents/routines')

    const morning = await card('Morgens', 'Montag bis Freitag')
    await user.click(morning.getByRole('button', { name: 'Schritt hinzufügen' }))
    // Angeboten wird nur, was morgens passt und noch nicht in dieser Routine steht.
    expect(morning.queryByRole('button', { name: /Schlafanzug/ })).toBeNull()
    await user.click(morning.getByRole('button', { name: /Kuscheltier/ }))

    expect(bodyOf(calls, 'POST /api/routines/1/steps')).toEqual({ task_id: 3 })
  })

  it('legt einen neuen Schritt an, ohne nach Kind, Tageszeit und Tagen zu fragen', async () => {
    const user = userEvent.setup()
    const calls = api([makeRoutine()], {
      'POST /api/routines/1/steps': Response.json(makeRoutine(), { status: 201 }),
    })
    renderApp('/parents/routines')

    const morning = await card('Morgens', 'Montag bis Freitag')
    await user.click(morning.getByRole('button', { name: 'Schritt hinzufügen' }))
    await user.click(morning.getByRole('button', { name: 'Neuer Schritt' }))

    expect(screen.getByText('Neuer Schritt für Lena · Morgens · Montag bis Freitag')).toBeVisible()
    expect(screen.queryByRole('checkbox', { name: /Lena/ })).toBeNull()
    expect(screen.queryByRole('radio', { name: 'Abends' })).toBeNull()
    expect(screen.queryByRole('radio', { name: 'Jeden Tag' })).toBeNull()

    await user.type(screen.getByLabelText('Titel'), 'Brotdose')
    await user.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(await screen.findByRole('status')).toHaveTextContent('„Brotdose“ ist gespeichert.')
    expect(bodyOf(calls, 'POST /api/routines/1/steps')).toMatchObject({
      task: {
        title: 'Brotdose',
        time_of_day: 'morning',
        extra: false,
        recurrence: { kind: 'daily' },
        member_ids: [1],
      },
    })
  })

  it('überträgt eine Routine auf ein anderes Kind und löscht eine Version', async () => {
    const user = userEvent.setup()
    const calls = api([WEEKDAY_MORNING], {
      'POST /api/routines': Response.json(makeRoutine({ id: 5, member_id: 2 }), { status: 201 }),
      'DELETE /api/routines/1': new Response(null, { status: 204 }),
    })
    renderApp('/parents/routines')

    const morning = await card('Morgens', 'Montag bis Freitag')
    await user.click(morning.getByRole('button', { name: 'Auf anderes Kind übertragen' }))
    // Nur andere Kinder, keine Erwachsenen.
    expect(morning.queryByRole('button', { name: /Mama/ })).toBeNull()
    await user.click(morning.getByRole('button', { name: /Tom/ }))

    expect(bodyOf(calls, 'POST /api/routines')).toEqual({
      member_id: 2,
      time_of_day: 'morning',
      weekdays: [1, 2, 3, 4, 5],
      copy_from: 1,
    })
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Lena · Morgens · Montag bis Freitag gilt jetzt auch für Tom.',
    )

    await user.click(morning.getByRole('button', { name: 'Löschen' }))
    expect(morning.getByText(/wirklich löschen\?/)).toBeVisible()
    await user.click(morning.getByRole('button', { name: 'Löschen' }))
    expect(calls.some((call) => call.key === 'DELETE /api/routines/1')).toBe(true)
  })

  it('zeigt im Editor, dass eine Aufgabe zu einer Routine gehört', async () => {
    const user = userEvent.setup()
    api([WEEKDAY_MORNING])
    renderApp('/parents/routines')

    const morning = await card('Morgens', 'Montag bis Freitag')
    await user.click(morning.getByRole('button', { name: 'Anziehen bearbeiten' }))

    expect(screen.getByText(/Schritt in der Routine \(Morgens\) von Lena/)).toBeVisible()
    // Tageszeit und Wiederholung legt die Routine fest.
    expect(screen.queryByRole('radio', { name: 'Abends' })).toBeNull()
    expect(screen.queryByRole('radio', { name: 'Jeden Tag' })).toBeNull()
    expect(screen.getByRole('checkbox', { name: /Lena/ })).toBeChecked()
  })
})
