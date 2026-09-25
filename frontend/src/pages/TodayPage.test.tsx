import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CalendarUpcoming, UpcomingEvent } from '../api/calendar'
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

const teeth = makeTodayTask({ id: 10 })
const bed = makeTodayTask({
  id: 11,
  title: 'Bett machen',
  icon: 'fluent-emoji-flat:bed',
  points: 1,
  done_member_ids: [1],
})
const trash = makeTodayTask({ id: 12, title: 'Müll rausbringen', member_ids: [2] })

const WEATHER: Weather = {
  place: { name: 'Köln', latitude: 50.94, longitude: 6.96 },
  current: { temperature: 12.4, code: 61, is_day: true },
  days: [
    { date: '2026-10-03', code: 61, max: 14.1, min: 8.2, precipitation: 80 },
    { date: '2026-10-04', code: 2, max: 16, min: 7.9, precipitation: 10 },
    { date: '2026-10-05', code: 0, max: 18.5, min: -0.4, precipitation: null },
  ],
  stale: false,
}

function makeEvent(overrides: Partial<UpcomingEvent> = {}): UpcomingEvent {
  return {
    key: '1',
    title: 'Schwimmen',
    all_day: false,
    // 15:00 bis 16:00 in Berlin.
    start: '2026-10-03T13:00:00Z',
    end: '2026-10-03T14:00:00Z',
    location: null,
    description: null,
    calendars: ['Lena'],
    member_ids: [1],
    family: false,
    continues_before: false,
    continues_after: false,
    day: '2026-10-03',
    ...overrides,
  }
}

const UPCOMING: CalendarUpcoming = {
  today: '2026-10-03',
  timezone: 'Europe/Berlin',
  family_color: 'pink',
  problem: false,
  holidays: [{ kind: 'public', name: 'Tag der Deutschen Einheit' }],
  events: [
    makeEvent(),
    makeEvent({
      key: '2',
      title: 'Oma besuchen',
      start: '2026-10-04T08:00:00Z',
      end: '2026-10-04T10:00:00Z',
      member_ids: [],
      family: true,
      day: '2026-10-04',
    }),
    makeEvent({
      key: '3',
      title: 'Elternabend',
      start: '2026-10-07T16:00:00Z',
      end: '2026-10-07T18:00:00Z',
      member_ids: [2],
      day: '2026-10-07',
    }),
  ],
}

function mockHome({
  weather = WEATHER,
  upcoming = UPCOMING,
  calendarEnabled = true,
  language = 'de',
}: {
  weather?: Weather
  upcoming?: CalendarUpcoming
  calendarEnabled?: boolean
  language?: string
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
          tasks: [{ ...teeth, done_member_ids: teethDone ? [1] : [] }, bed, trash],
          points: [{ member_id: 1, today: 1, total: 10, week_done: 1 }],
        }),
      ),
    'GET /api/weather': Response.json(weather),
    'GET /api/calendar/status': Response.json({ enabled: calendarEnabled }),
    'GET /api/calendar/upcoming': Response.json(upcoming),
    'PUT /api/today/tasks/10/members/1': () => {
      teethDone = true
      return new Response(null, { status: 204 })
    },
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

  it('zeigt das Wetter jetzt, heute und an den nächsten Tagen', async () => {
    mockHome()
    renderApp('/')

    const weather = await region('Wetter')
    expect(await weather.findByText('12°')).toBeVisible()
    expect(weather.getByText('Regen', { selector: 'p' })).toBeVisible()
    expect(weather.getByText('Köln')).toBeVisible()
    expect(weather.getByText('14° / 8°')).toBeVisible()
    expect(weather.getByText('Regen 80 %')).toBeVisible()
    // Kein „-0°“.
    expect(weather.getByText('19° / 0°')).toBeVisible()
  })

  it('verweist ohne Ort für das Wetter auf den Elternbereich', async () => {
    mockHome({ weather: { place: null, current: null, days: [], stale: false } })
    renderApp('/')

    const weather = await region('Wetter')
    expect(await weather.findByRole('link', { name: 'Einrichten' })).toHaveAttribute(
      'href',
      '/parents',
    )
  })

  it('zeigt die nächsten Termine mit Tag und öffnet die Details', async () => {
    const user = userEvent.setup()
    mockHome()
    renderApp('/')

    const events = await region('Termine')
    const cards = await events.findAllByTestId('calendar-event')
    expect(cards.map((card) => card.textContent)).toEqual([
      expect.stringContaining('Heute · 15:00–16:00 UhrSchwimmen'),
      expect.stringContaining('Morgen · 10:00–12:00 UhrOma besuchen'),
      expect.stringContaining('Mi., 7.10. · 18:00–20:00 UhrElternabend'),
    ])
    expect(events.getByTestId('holiday')).toHaveTextContent('Tag der Deutschen Einheit')
    expect(events.getByRole('link', { name: 'Kalender öffnen' })).toHaveAttribute(
      'href',
      '/calendar',
    )

    await user.click(within(cards[1]).getByRole('button'))
    expect(await screen.findByRole('dialog', { name: 'Oma besuchen' })).toBeVisible()
  })

  it('verweist ohne Kalender auf den Elternbereich', async () => {
    mockHome({ calendarEnabled: false })
    renderApp('/')

    const events = await region('Termine')
    expect(await events.findByRole('link', { name: 'Einrichten' })).toBeVisible()
    expect(events.queryByRole('link', { name: 'Kalender öffnen' })).toBeNull()
  })

  it('zeigt die Aufgaben aller Personen und erledigt sie mit einem Tipp', async () => {
    const user = userEvent.setup()
    const calls = mockHome()
    renderApp('/')

    const lena = within(await screen.findByRole('listitem', { name: 'Aufgaben von Lena' }))
    expect(lena.getByRole('img', { name: '1 von 2 Aufgaben erledigt' })).toBeInTheDocument()
    expect(lena.getByRole('button', { name: /^Bett machen/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    const card = lena.getByRole('button', { name: /^Zähne putzen/ })
    expect(card).toHaveAttribute('aria-pressed', 'false')

    await user.click(card)

    expect(card).toHaveAttribute('aria-pressed', 'true')
    expect(lena.getByTestId('points-feedback')).toHaveTextContent('+2')
    expect(calls.some((call) => call.key === 'PUT /api/today/tasks/10/members/1')).toBe(true)
    const papa = within(screen.getByRole('listitem', { name: 'Aufgaben von Papa' }))
    expect(papa.getByRole('button', { name: 'Müll rausbringen' })).toBeVisible()
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

  it('hält Platz für Essen und Einkauf frei, als „kommt bald“ gekennzeichnet', async () => {
    mockHome()
    renderApp('/')

    for (const name of ['Essen', 'Einkauf']) {
      expect((await region(name)).getByText('Kommt bald')).toBeVisible()
    }
  })

  it('funktioniert auch auf Englisch', async () => {
    await i18n.changeLanguage('en')
    mockHome({ language: 'en' })
    renderApp('/')

    expect(await screen.findByRole('region', { name: 'Weather' })).toBeVisible()
    const events = await region('Events')
    const cards = await events.findAllByTestId('calendar-event')
    expect(cards[1]).toHaveTextContent('Tomorrow')
    expect(await screen.findByRole('listitem', { name: "Lena's tasks" })).toBeVisible()
    expect((await region('Meals')).getByText('Coming soon')).toBeVisible()
  })
})
