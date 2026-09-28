import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CalendarWeek, WeekEvent } from '../api/calendar'
import { DEFAULT_TILES, type Tile } from '../api/home'
import type { MealWeek } from '../api/meals'
import type { Weather } from '../api/weather'
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

beforeEach(async () => {
  await i18n.changeLanguage('de')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const LENA = makeMember()
const PAPA = makeMember({ id: 2, name: 'Papa', role: 'parent', color: 'blue' })

// Heute ist Samstag, 3. Oktober, morgens.
const teeth = makeTodayTask({ id: 10 })
const bed = makeTodayTask({
  id: 11,
  title: 'Bett machen',
  icon: 'fluent-emoji-flat:bed',
  points: 1,
  done_member_ids: [1],
})
const pyjamas = makeTodayTask({ id: 13, title: 'Schlafanzug', time_of_day: 'evening' })
const trash = makeTodayTask({ id: 12, title: 'Müll rausbringen', member_ids: [2] })

const WEATHER: Weather = {
  place: { name: 'Köln', latitude: 50.94, longitude: 6.96 },
  current: { temperature: 12.4, code: 61, is_day: true },
  days: [
    { date: '2026-10-03', code: 61, max: 14.1, min: -0.4, precipitation: 80 },
    { date: '2026-10-04', code: 2, max: 16, min: 7.9, precipitation: 10 },
  ],
  stale: false,
}

function makeEvent(overrides: Partial<WeekEvent> = {}): WeekEvent {
  return {
    key: '1',
    title: 'Schwimmen',
    start: '2026-10-03T13:00:00Z',
    end: '2026-10-03T14:00:00Z',
    all_day: false,
    location: null,
    description: null,
    calendars: ['Lena'],
    member_ids: [1],
    family: false,
    icon: null,
    continues_before: false,
    continues_after: false,
    ...overrides,
  }
}

const DAYS = ['09-28', '09-29', '09-30', '10-01', '10-02', '10-03', '10-04']

function eventsOn(day: string): WeekEvent[] {
  if (day === '10-03') return [makeEvent()]
  if (day === '10-04') {
    return [
      makeEvent({
        key: '2',
        title: 'Oma besuchen',
        start: '2026-10-04T08:00:00Z',
        end: '2026-10-04T10:00:00Z',
        member_ids: [],
        family: true,
      }),
    ]
  }
  // Vor heute: steht nicht auf der Startseite.
  if (day === '10-02')
    return [makeEvent({ key: '3', title: 'Turnen', start: '2026-10-02T13:00:00Z' })]
  return []
}

const CALENDAR: CalendarWeek = {
  start: '2026-09-28',
  today: '2026-10-03',
  timezone: 'Europe/Berlin',
  family_color: 'pink',
  problem: false,
  days: DAYS.map((day) => ({
    date: `2026-${day}`,
    holidays:
      day === '10-03' ? [{ kind: 'public' as const, name: 'Tag der Deutschen Einheit' }] : [],
    events: eventsOn(day),
  })),
}

const MEAL_WEEK: MealWeek = {
  start: '2026-09-28',
  today: '2026-10-03',
  meals: ['dinner'],
  entries: [
    {
      date: '2026-10-02',
      meal: 'dinner',
      dish_id: 1,
      name: 'Fischstäbchen',
      icon: 'fluent-emoji-flat:fish',
      image_url: null,
    },
    {
      date: '2026-10-03',
      meal: 'dinner',
      dish_id: 2,
      name: 'Ofengemüse mit Würstchen',
      icon: 'fluent-emoji-flat:hot-dog',
      image_url: null,
    },
  ],
}

function mockHome({
  weather = WEATHER,
  calendarEnabled = true,
  language = 'de',
  tasks = [teeth, bed, pyjamas, trash],
  extra = {},
}: {
  weather?: Weather
  calendarEnabled?: boolean
  language?: string
  tasks?: ReturnType<typeof makeTodayTask>[]
  /** Weitere oder abweichende Antworten, z. B. für den Aufbau der Startseite. */
  extra?: Parameters<typeof mockApi>[0]
} = {}) {
  // Wie der Server: Nach dem Erledigen liefert GET /api/today die Aufgabe als erledigt.
  let teethDone = false
  return mockApi({
    'GET /api/setup/status': setupDone,
    'GET /api/auth/me': Response.json(
      makeMe({ family: { ...makeMe().family, default_language: language } }),
    ),
    'GET /api/members': Response.json([LENA, PAPA]),
    'GET /api/today': () =>
      Response.json(
        makeToday({
          tasks: tasks.map((task) =>
            task.id === teeth.id && teethDone ? { ...task, done_member_ids: [1] } : task,
          ),
          points: [{ member_id: 1, today: 1, total: 10, week_done: 1 }],
        }),
      ),
    'GET /api/weather': Response.json(weather),
    'GET /api/calendar/status': Response.json({ enabled: calendarEnabled }),
    // Diese und nächste Woche bekommen dieselbe Antwort; es zählen nur die Tage ab heute.
    'GET /api/calendar/week': Response.json(CALENDAR),
    'GET /api/meals/week': Response.json(MEAL_WEEK),
    'GET /api/dishes': Response.json([]),
    'PUT /api/today/tasks/10/members/1': () => {
      teethDone = true
      return new Response(null, { status: 204 })
    },
    ...extra,
  })
}

const region = async (name: string) => within(await screen.findByRole('region', { name }))

describe('Startseite „Heute“', () => {
  it('ist die Startseite und hat ein eigenes Symbol in der Navigation', async () => {
    mockHome()
    renderApp('/')

    const nav = await screen.findByRole('navigation', { name: 'Hauptnavigation' })
    expect(within(nav).getByRole('link', { name: 'Heute' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Aufgaben' })).toHaveAttribute('href', '/tasks')
    expect(await screen.findByRole('heading', { name: 'Familie Sonnenschein' })).toBeVisible()
    expect(await screen.findByText('Samstag, 3. Oktober')).toBeVisible()
  })

  it('zeigt das Wetter klein im Kopf', async () => {
    mockHome()
    renderApp('/')

    const weather = await region('Wetter')
    expect(await weather.findByText('12°', { exact: false })).toBeVisible()
    // Kein „-0°“.
    expect(weather.getByText('14° / 0°')).toBeVisible()
    expect(weather.getByText('Regen 80 %')).toBeVisible()
  })

  it('verweist ohne Ort für das Wetter auf den Elternbereich', async () => {
    mockHome({ weather: { place: null, current: null, days: [], stale: false } })
    renderApp('/')

    expect(await screen.findByRole('link', { name: 'Wetter einrichten' })).toHaveAttribute(
      'href',
      '/parents/connections',
    )
  })

  it('zeigt die nächsten sieben Tage ab heute mit Terminen und Essen', async () => {
    const user = userEvent.setup()
    mockHome()
    renderApp('/')

    const board = await region('Die nächsten sieben Tage')
    const days = await board.findAllByRole('region')
    expect(days.map((day) => day.getAttribute('aria-label'))).toEqual([
      'Samstag, 3. Oktober',
      'Sonntag, 4. Oktober',
      'Montag, 5. Oktober',
      'Dienstag, 6. Oktober',
      'Mittwoch, 7. Oktober',
      'Donnerstag, 8. Oktober',
      'Freitag, 9. Oktober',
    ])
    expect(days[0]).toHaveAttribute('aria-current', 'date')

    const today = within(days[0])
    expect(await today.findByText('Schwimmen')).toBeVisible()
    expect(today.getByTestId('holiday')).toHaveTextContent('Tag der Deutschen Einheit')
    expect(
      await today.findByRole('button', { name: 'Abendessen: Ofengemüse mit Würstchen, ändern' }),
    ).toBeVisible()
    expect(board.queryByText('Turnen')).not.toBeInTheDocument()
    expect(board.queryByText('Fischstäbchen')).not.toBeInTheDocument()

    const tomorrow = within(days[1])
    expect(tomorrow.getByText('Oma besuchen')).toBeVisible()
    expect(tomorrow.getByRole('button', { name: 'Abendessen eintragen' })).toBeVisible()

    await user.click(within(tomorrow.getByTestId('calendar-event')).getByRole('button'))
    expect(await screen.findByRole('dialog', { name: 'Oma besuchen' })).toBeVisible()
  })

  it('trägt das Essen direkt auf der Startseite ein', async () => {
    const user = userEvent.setup()
    const calls = mockHome({
      extra: {
        'PUT /api/meals/2026-10-04/dinner': (body) =>
          Response.json({ date: '2026-10-04', meal: 'dinner', dish_id: 3, ...(body as object) }),
      },
    })
    renderApp('/')

    const tomorrow = await region('Sonntag, 4. Oktober')
    await user.click(await tomorrow.findByRole('button', { name: 'Abendessen eintragen' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Abendessen, Sonntag, 4. Oktober' }))
    await user.click(dialog.getByRole('button', { name: 'Pizza' }))

    expect(calls.find((call) => call.key === 'PUT /api/meals/2026-10-04/dinner')?.body).toEqual({
      name: 'Pizza',
      icon: 'fluent-emoji-flat:pizza',
    })
  })

  it('verweist ohne Kalender auf den Elternbereich und zeigt trotzdem das Essen', async () => {
    mockHome({ calendarEnabled: false })
    renderApp('/')

    expect(await screen.findByRole('link', { name: 'Kalender verbinden' })).toHaveAttribute(
      'href',
      '/parents/connections',
    )
    const today = await region('Samstag, 3. Oktober')
    expect(
      await today.findByRole('button', { name: 'Abendessen: Ofengemüse mit Würstchen, ändern' }),
    ).toBeVisible()
    expect(today.queryByText('Schwimmen')).not.toBeInTheDocument()
  })

  it('zeigt nur die aktuelle Routine der Kinder und erledigt sie mit einem Tipp', async () => {
    const user = userEvent.setup()
    const calls = mockHome()
    renderApp('/')

    const routine = await region('Morgens')
    const lena = within(await routine.findByRole('listitem', { name: 'Aufgaben von Lena' }))
    expect(lena.getByRole('button', { name: /^Bett machen/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    // Abends ist noch nicht dran; Erwachsene stehen hier nicht.
    expect(lena.queryByRole('button', { name: /^Schlafanzug/ })).not.toBeInTheDocument()
    expect(routine.queryByRole('listitem', { name: 'Aufgaben von Papa' })).not.toBeInTheDocument()
    expect(screen.queryByText('Müll rausbringen')).not.toBeInTheDocument()

    await user.click(lena.getByRole('button', { name: /^Zähne putzen/ }))

    expect(lena.getByTestId('points-feedback')).toHaveTextContent('+2')
    expect(calls.some((call) => call.key === 'PUT /api/today/tasks/10/members/1')).toBe(true)
    // Nach einem kurzen Moment (für das Feedback) steht nur noch „Alles erledigt“.
    expect(await lena.findByText('Alles erledigt', {}, { timeout: 3000 })).toBeVisible()
    expect(lena.queryByRole('button', { name: /^Zähne putzen/ })).not.toBeInTheDocument()
  })

  it('zeigt „Alles erledigt“ auch, wenn gerade keine Routine dran ist', async () => {
    mockHome({ tasks: [pyjamas] })
    renderApp('/')

    const lena = within(await screen.findByRole('listitem', { name: 'Aufgaben von Lena' }))
    expect(lena.getByText('Alles erledigt')).toBeVisible()
  })

  it('öffnet die Person über den Avatar und führt zurück zur Startseite', async () => {
    const user = userEvent.setup()
    mockHome()
    renderApp('/')

    await user.click(await screen.findByRole('link', { name: 'Lena öffnen' }))
    expect(await screen.findByRole('heading', { name: 'Lena', level: 1 })).toBeVisible()

    await user.click(screen.getByRole('link', { name: 'Zurück' }))
    expect(await screen.findByRole('link', { name: 'Alle Aufgaben öffnen' })).toBeVisible()
  })

  it('hält Platz für den Einkauf frei, als „kommt bald“ gekennzeichnet', async () => {
    mockHome()
    renderApp('/')

    expect((await region('Einkauf')).getByText('Kommt bald')).toBeVisible()
  })

  it('funktioniert auch auf Englisch', async () => {
    await i18n.changeLanguage('en')
    mockHome({ language: 'en' })
    renderApp('/')

    expect(await screen.findByRole('region', { name: 'Weather' })).toBeVisible()
    expect(await screen.findByRole('region', { name: 'The next seven days' })).toBeVisible()
    expect(await screen.findByRole('listitem', { name: "Lena's tasks" })).toBeVisible()
    expect((await region('Shopping')).getByText('Coming soon')).toBeVisible()
    expect(
      await screen.findByRole('button', { name: 'Dinner: Ofengemüse mit Würstchen, change' }),
    ).toBeVisible()
  })
})

async function enterPin(user: ReturnType<typeof userEvent.setup>, pin: string) {
  for (const digit of pin) await user.click(screen.getByRole('button', { name: digit }))
  await user.click(screen.getByRole('button', { name: 'Bestätigen' }))
}

describe('Startseite anpassen', () => {
  it('blendet ausgeschaltete Bereiche aus', async () => {
    const tiles: Tile[] = DEFAULT_TILES.map((tile) => ({
      ...tile,
      visible: tile.id !== 'events' && tile.id !== 'shopping',
    }))
    mockHome({ extra: { 'GET /api/home/layout': Response.json({ tiles }) } })
    renderApp('/')

    const today = await region('Samstag, 3. Oktober')
    expect(
      await today.findByRole('button', { name: 'Abendessen: Ofengemüse mit Würstchen, ändern' }),
    ).toBeVisible()
    expect(today.queryByText('Schwimmen')).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Einkauf' })).not.toBeInTheDocument()
  })

  it('verlangt die Eltern-PIN, speichert den neuen Aufbau und sperrt danach wieder', async () => {
    const user = userEvent.setup()
    const calls = mockHome({
      extra: {
        'GET /api/home/layout': Response.json({ tiles: DEFAULT_TILES }),
        'POST /api/parent/unlock': Response.json(makeMe({ parent_unlocked: true })),
        'PUT /api/home/layout': (body) => Response.json(body),
        'POST /api/parent/lock': Response.json(makeMe()),
      },
    })
    renderApp('/')

    await user.click(await screen.findByRole('button', { name: 'Startseite anpassen' }))
    const dialog = await screen.findByRole('dialog', { name: 'Startseite anpassen' })
    expect(within(dialog).getByRole('heading', { name: 'Eltern-PIN eingeben' })).toBeVisible()
    await enterPin(user, '1234')

    const editor = await region('Startseite anpassen')
    // Die Anordnung ist fest: nur ein- und ausschalten.
    expect(editor.queryByRole('button', { name: /nach oben/ })).not.toBeInTheDocument()
    await user.click(editor.getByRole('switch', { name: 'Wetter anzeigen' }))
    await user.click(editor.getByRole('switch', { name: 'Routine der Kinder anzeigen' }))
    // Die Vorschau darunter folgt sofort.
    expect(screen.queryByRole('region', { name: 'Wetter' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Morgens' })).not.toBeInTheDocument()

    await user.click(editor.getByRole('button', { name: 'Speichern' }))

    expect(await screen.findByRole('button', { name: 'Startseite anpassen' })).toBeInTheDocument()
    const put = calls.find((call) => call.key === 'PUT /api/home/layout')
    expect(put?.body).toEqual({
      tiles: [
        { id: 'weather', visible: false },
        { id: 'tasks', visible: false },
        { id: 'shopping', visible: true },
        { id: 'events', visible: true },
        { id: 'meals', visible: true },
      ],
    })
    expect(calls.some((call) => call.key === 'POST /api/parent/lock')).toBe(true)
  })

  it('verwirft Änderungen mit „Abbrechen“; „Standard“ setzt nur den Entwurf zurück', async () => {
    const user = userEvent.setup()
    const tiles: Tile[] = DEFAULT_TILES.map((tile) => ({ ...tile, visible: tile.id !== 'meals' }))
    const calls = mockHome({
      extra: {
        'GET /api/auth/me': Response.json(makeMe({ parent_unlocked: true })),
        'GET /api/home/layout': Response.json({ tiles }),
        'POST /api/parent/lock': Response.json(makeMe()),
      },
    })
    renderApp('/')

    // Schon entsperrt (oder ohne PIN): keine Abfrage.
    await user.click(await screen.findByRole('button', { name: 'Startseite anpassen' }))
    const editor = await region('Startseite anpassen')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(editor.getByRole('switch', { name: 'Essen anzeigen' })).not.toBeChecked()

    await user.click(editor.getByRole('button', { name: 'Standard wiederherstellen' }))
    expect(editor.getByRole('switch', { name: 'Essen anzeigen' })).toBeChecked()

    await user.click(editor.getByRole('button', { name: 'Abbrechen' }))

    await screen.findByRole('button', { name: 'Startseite anpassen' })
    expect(screen.queryByRole('button', { name: /^Abendessen/ })).not.toBeInTheDocument()
    expect(calls.some((call) => call.key === 'PUT /api/home/layout')).toBe(false)
    expect(calls.some((call) => call.key === 'POST /api/parent/lock')).toBe(true)
  })
})
