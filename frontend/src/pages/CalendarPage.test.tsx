import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CalendarWeek, WeekEvent } from '../api/calendar'
import i18n from '../i18n'
import { makeMe, makeMember, makeToday, mockApi, renderApp, setupDone } from '../test/utils'

beforeEach(async () => {
  await i18n.changeLanguage('de')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const LENA = makeMember()
const PAPA = makeMember({ id: 2, name: 'Papa', role: 'parent', color: 'blue' })

function makeEvent(overrides: Partial<WeekEvent> = {}): WeekEvent {
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
    ...overrides,
  }
}

function makeWeek(saturday: WeekEvent[], overrides: Partial<CalendarWeek> = {}): CalendarWeek {
  const dates = ['09-28', '09-29', '09-30', '10-01', '10-02', '10-03', '10-04']
  return {
    start: '2026-09-28',
    today: '2026-10-03',
    timezone: 'Europe/Berlin',
    family_color: 'pink',
    problem: false,
    days: dates.map((date) => ({
      date: `2026-${date}`,
      holidays: [],
      events: date === '10-03' ? saturday : [],
    })),
    ...overrides,
  }
}

function mockCalendar(week: CalendarWeek | null, enabled = true, language = 'de') {
  return mockApi({
    'GET /api/setup/status': setupDone,
    'GET /api/auth/me': Response.json(
      makeMe({ family: { ...makeMe().family, default_language: language } }),
    ),
    'GET /api/today': Response.json(makeToday()),
    'GET /api/members': Response.json([LENA, PAPA]),
    'GET /api/calendar/status': Response.json({ enabled }),
    ...(week ? { 'GET /api/calendar/week': Response.json(week) } : {}),
  })
}

async function saturday() {
  return within(await screen.findByRole('region', { name: 'Samstag, 3. Oktober' }))
}

describe('Kalender (Woche)', () => {
  it('erscheint in der Navigation, sobald ein Kalender ausgewählt ist', async () => {
    mockCalendar(makeWeek([]))
    renderApp('/')

    expect(await screen.findByRole('link', { name: 'Kalender' })).toHaveAttribute(
      'href',
      '/calendar',
    )
  })

  it('fehlt in der Navigation ohne ausgewählten Kalender', async () => {
    mockCalendar(null, false)
    renderApp('/calendar')

    expect(await screen.findByText('Noch kein Kalender ausgewählt')).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Kalender' })).toBeNull()
  })

  it('zeigt die Woche mit Terminen in Personenfarben', async () => {
    mockCalendar(
      makeWeek([
        makeEvent({
          key: 'a',
          title: 'Ausflug',
          all_day: true,
          start: '2026-10-03',
          end: '2026-10-04',
          member_ids: [],
          family: true,
        }),
        makeEvent({ key: 'b' }),
        makeEvent({ key: 'c', title: null, member_ids: [1, 2] }),
      ]),
    )
    renderApp('/calendar')

    expect(
      await screen.findByRole('heading', { level: 1, name: /28\. September\s*–\s*4\. Oktober/ }),
    ).toBeVisible()
    const day = await saturday()
    expect(day.getByText('Heute')).toBeVisible()
    const [trip, swimming, untitled] = day.getAllByTestId('calendar-event')
    expect(trip).toHaveTextContent('Ausflug')
    expect(trip).toHaveTextContent('Für Familie')
    expect(swimming).toHaveTextContent(/15:00\s*–\s*16:00/)
    expect(swimming).toHaveTextContent('Für Lena')
    // Ohne Titel ein Platzhalter; mehrere Personen an einem Termin.
    expect(untitled).toHaveTextContent('Termin')
    expect(untitled).toHaveTextContent('Für Lena, Papa')

    const sunday = within(screen.getByRole('region', { name: 'Sonntag, 4. Oktober' }))
    expect(sunday.getByText('Keine Termine')).toBeVisible()
  })

  it('zeigt mehrtägige Termine mit Beginn bzw. Ende', async () => {
    mockCalendar(
      makeWeek([
        makeEvent({ key: 'a', title: 'Nachtschicht', continues_after: true }),
        makeEvent({ key: 'b', title: 'Seit gestern', continues_before: true }),
      ]),
    )
    renderApp('/calendar')

    const [night, since] = (await saturday()).getAllByTestId('calendar-event')
    expect(night).toHaveTextContent('ab 15:00')
    expect(since).toHaveTextContent('bis 16:00')
  })

  it('filtert per Tipp auf einen Avatar, Familientermine bleiben sichtbar', async () => {
    const user = userEvent.setup()
    mockCalendar(
      makeWeek([
        makeEvent({ key: 'a', title: 'Ausflug', member_ids: [], family: true }),
        makeEvent({ key: 'b', title: 'Schwimmen', member_ids: [1] }),
        makeEvent({ key: 'c', title: 'Zahnarzt', member_ids: [2] }),
      ]),
    )
    renderApp('/calendar')
    const day = await saturday()
    expect(day.getAllByTestId('calendar-event')).toHaveLength(3)

    const filter = within(screen.getByRole('group', { name: 'Termine nach Person filtern' }))
    await user.click(filter.getByRole('button', { name: 'Lena' }))
    expect(day.getAllByTestId('calendar-event').map((e) => e.textContent)).toEqual([
      expect.stringContaining('Ausflug'),
      expect.stringContaining('Schwimmen'),
    ])

    await user.click(filter.getByRole('button', { name: 'Familie' }))
    expect(day.getAllByTestId('calendar-event')).toHaveLength(1)

    await user.click(filter.getByRole('button', { name: 'Familie' }))
    expect(day.getAllByTestId('calendar-event')).toHaveLength(3)
  })

  it('blättert zur nächsten Woche und zurück', async () => {
    const user = userEvent.setup()
    const calls = mockCalendar(makeWeek([]))
    renderApp('/calendar')
    await saturday()

    await user.click(screen.getByRole('button', { name: 'Nächste Woche' }))
    await user.click(await screen.findByRole('button', { name: 'Diese Woche' }))

    expect(calls.filter((call) => call.key === 'GET /api/calendar/week')).toHaveLength(3)
  })

  it('weist auf Probleme bei der Aktualisierung hin', async () => {
    mockCalendar(makeWeek([], { problem: true }))
    renderApp('/calendar')

    expect(await screen.findByText(/wird gerade nicht aktualisiert/)).toBeVisible()
  })

  it('funktioniert auf Englisch', async () => {
    await i18n.changeLanguage('en')
    mockCalendar(makeWeek([makeEvent()]), true, 'en')
    renderApp('/calendar')

    const day = within(await screen.findByRole('region', { name: 'Saturday, October 3' }))
    expect(day.getByText('Today')).toBeVisible()
    expect(day.getByTestId('calendar-event')).toHaveTextContent('For Lena')
  })

  it('öffnet die Details eines Termins und schließt sie wieder', async () => {
    const user = userEvent.setup()
    mockCalendar(
      makeWeek([
        makeEvent({
          title: 'Zahnarzt',
          location: 'Hauptstr. 1',
          description: 'Karte mitbringen',
          member_ids: [1, 2],
          calendars: ['Lena', 'Stefan'],
        }),
      ]),
    )
    renderApp('/calendar')

    await user.click((await saturday()).getByRole('button', { name: /Zahnarzt/ }))

    const dialog = within(screen.getByRole('dialog', { name: 'Zahnarzt' }))
    expect(dialog.getByText(/Samstag, 3\. Oktober/)).toHaveTextContent(/15:00\s*–\s*16:00/)
    expect(dialog.getByText('Hauptstr. 1')).toBeVisible()
    expect(dialog.getByText('Karte mitbringen')).toBeVisible()
    expect(dialog.getByText('Papa')).toBeVisible()
    expect(dialog.getByText('Aus den Kalendern Lena, Stefan')).toBeVisible()

    await user.click(dialog.getByRole('button', { name: 'Schließen' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('zeigt ganztägige Termine wie andere, nur mit „Ganztägig“ statt Uhrzeit', async () => {
    mockCalendar(
      makeWeek([
        makeEvent({ title: 'Ausflug', all_day: true, start: '2026-10-03', end: '2026-10-05' }),
      ]),
    )
    renderApp('/calendar')

    expect((await saturday()).getByTestId('calendar-event')).toHaveTextContent('GanztägigAusflug')
  })

  it('zeigt Feiertage und Ferien dezent über den Terminen', async () => {
    const week = makeWeek([])
    week.days[5]!.holidays = [
      { kind: 'public', name: 'Tag der Deutschen Einheit' },
      { kind: 'school', name: 'Herbstferien' },
    ]
    mockCalendar(week)
    renderApp('/calendar')

    const day = await saturday()
    const [holiday, school] = day.getAllByTestId('holiday')
    expect(holiday).toHaveTextContent('Feiertag: Tag der Deutschen Einheit')
    expect(school).toHaveTextContent('Ferien: Herbstferien')
    expect(day.queryByText('Keine Termine')).toBeNull()
  })
})
