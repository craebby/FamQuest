import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Calendar, CalendarSettings } from '../../api/calendar'
import i18n from '../../i18n'
import { makeMe, makeMember, makeToday, mockApi, renderApp, setupDone } from '../../test/utils'

beforeEach(async () => {
  await i18n.changeLanguage('de')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const REDIRECT_URI = 'https://familie.example.com/api/calendar/google/callback'

function mockParents(settings: CalendarSettings, extra: Parameters<typeof mockApi>[0] = {}) {
  return mockApi({
    'GET /api/setup/status': setupDone,
    'GET /api/auth/me': Response.json(makeMe({ parent_unlocked: true })),
    'GET /api/members': Response.json([]),
    'GET /api/tasks': Response.json([]),
    'GET /api/rewards': Response.json([]),
    'GET /api/approvals': Response.json([]),
    'GET /api/today': Response.json(makeToday()),
    'GET /api/calendar/settings': Response.json(settings),
    ...extra,
  })
}

async function calendarSection() {
  return within((await screen.findByRole('heading', { name: 'Kalender', level: 2 })).parentElement!)
}

describe('Kalender im Elternbereich', () => {
  it('erklärt die fehlende Einrichtung und zeigt die Weiterleitungs-URI', async () => {
    mockParents({
      configured: false,
      redirect_uri: REDIRECT_URI,
      family_color: 'pink',
      connections: [],
    })
    renderApp('/parents')

    const section = await calendarSection()
    expect(await section.findByText(/noch nicht eingerichtet/)).toBeVisible()
    expect(section.getByText(REDIRECT_URI)).toBeVisible()
    expect(section.queryByRole('button', { name: /verbinden/ })).toBeNull()
  })

  it('startet die Anmeldung bei Google', async () => {
    const user = userEvent.setup()
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })
    const calls = mockParents(
      { configured: true, redirect_uri: REDIRECT_URI, family_color: 'pink', connections: [] },
      {
        'POST /api/calendar/google/connect': Response.json({
          url: 'https://accounts.google.com/o/oauth2/v2/auth?state=abc',
        }),
      },
    )
    renderApp('/parents')

    const section = await calendarSection()
    await user.click(await section.findByRole('button', { name: 'Google-Konto verbinden' }))

    expect(calls.some((call) => call.key === 'POST /api/calendar/google/connect')).toBe(true)
    expect(assign).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2/v2/auth?state=abc')
  })

  it('zeigt Verbindungen, markiert abgelaufene und trennt nach Rückfrage', async () => {
    const user = userEvent.setup()
    const calls = mockParents(
      {
        configured: true,
        redirect_uri: REDIRECT_URI,
        family_color: 'pink',
        connections: [
          {
            id: 1,
            provider: 'google',
            account_email: 'mama@gmail.com',
            status: 'ok',
            created_at: '2026-09-25T10:00:00Z',
            calendars: [],
          },
          {
            id: 2,
            provider: 'google',
            account_email: 'papa@gmail.com',
            status: 'reconnect',
            created_at: '2026-09-25T10:00:00Z',
            calendars: [],
          },
        ],
      },
      { 'DELETE /api/calendar/connections/1': new Response(null, { status: 204 }) },
    )
    renderApp('/parents')

    const section = await calendarSection()
    const [mama, papa] = await section.findAllByTestId('calendar-connection')
    expect(within(mama!).getByText('Verbunden')).toBeVisible()
    expect(within(papa!).getByText(/Bitte neu verbinden/)).toBeVisible()
    expect(within(papa!).getByRole('button', { name: 'Neu verbinden' })).toBeVisible()

    await user.click(within(mama!).getByRole('button', { name: 'Trennen' }))
    expect(within(mama!).getByText(/wirklich trennen/)).toBeVisible()
    await user.click(within(mama!).getByRole('button', { name: 'Trennen' }))

    expect(await screen.findByRole('status')).toHaveTextContent('mama@gmail.com wurde getrennt')
    expect(calls.some((call) => call.key === 'DELETE /api/calendar/connections/1')).toBe(true)
  })

  it('meldet das Ergebnis nach der Rückkehr von Google', async () => {
    mockParents({
      configured: true,
      redirect_uri: REDIRECT_URI,
      family_color: 'pink',
      connections: [],
    })
    renderApp('/parents?calendar_error=calendar.scope_missing')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Der Zugriff auf den Kalender wurde nicht erlaubt',
    )
  })

  it('bestätigt eine erfolgreiche Verbindung', async () => {
    mockParents({
      configured: true,
      redirect_uri: REDIRECT_URI,
      family_color: 'pink',
      connections: [],
    })
    renderApp('/parents?calendar=connected')

    expect(await screen.findByText('Google-Konto verbunden')).toBeVisible()
  })

  it('wählt Kalender aus und ordnet sie einer Person oder der Familie zu', async () => {
    const user = userEvent.setup()
    const settings = withCalendars([
      makeCalendar({ id: 1, name: 'Lena', selected: true, member_id: 1 }),
      makeCalendar({ id: 2, name: 'Allgemein', primary: false, synced_at: null }),
    ])
    const calls = mockParents(settings, {
      'GET /api/members': Response.json([
        makeMember(),
        makeMember({ id: 2, name: 'Papa', role: 'parent', color: 'blue' }),
      ]),
      'PUT /api/calendar/calendars/2': Response.json(settings),
      'PUT /api/calendar/calendars/1': Response.json(settings),
    })
    renderApp('/parents')

    const section = await calendarSection()
    const [lena, general] = await section.findAllByTestId('calendar')
    expect(within(lena!).getByRole('radio', { name: 'Lena' })).toBeChecked()
    expect(within(lena!).getByText(/Aktualisiert/)).toBeVisible()
    // Nicht ausgewählt: keine Zuordnung.
    expect(within(general!).queryByRole('radio')).toBeNull()

    await user.click(within(general!).getByRole('switch', { name: 'Allgemein anzeigen' }))
    expect(calls.find((call) => call.key === 'PUT /api/calendar/calendars/2')?.body).toEqual({
      selected: true,
      member_id: null,
    })

    await user.click(within(lena!).getByRole('radio', { name: 'Familie' }))
    expect(calls.find((call) => call.key === 'PUT /api/calendar/calendars/1')?.body).toEqual({
      selected: true,
      member_id: null,
    })
  })

  it('zeigt Fehler der Synchronisation am Kalender', async () => {
    mockParents(
      withCalendars([
        makeCalendar({ selected: true, member_id: null, sync_error: 'calendar.rate_limited' }),
      ]),
    )
    renderApp('/parents')

    const [calendar] = await (await calendarSection()).findAllByTestId('calendar')
    expect(within(calendar!).getByText(/Google bremst gerade/)).toBeVisible()
  })

  it('ändert die Farbe der Familie, vergebene Farben sind gesperrt', async () => {
    const user = userEvent.setup()
    const settings = withCalendars([makeCalendar()])
    const calls = mockParents(settings, {
      'GET /api/members': Response.json([makeMember()]),
      'PUT /api/calendar/family-color': Response.json({ ...settings, family_color: 'slate' }),
    })
    renderApp('/parents')

    const section = await calendarSection()
    expect(await section.findByRole('radio', { name: 'Lila (gehört Lena)' })).toBeDisabled()
    expect(section.getByRole('radio', { name: 'Rosa' })).toBeChecked()

    await user.click(section.getByRole('radio', { name: 'Grau' }))

    expect(calls.find((call) => call.key === 'PUT /api/calendar/family-color')?.body).toEqual({
      color: 'slate',
    })
    expect(await section.findByRole('radio', { name: 'Grau' })).toBeChecked()
  })

  it('aktualisiert auf Wunsch sofort', async () => {
    const user = userEvent.setup()
    const settings = withCalendars([makeCalendar({ selected: true })])
    const calls = mockParents(settings, { 'POST /api/calendar/sync': Response.json(settings) })
    renderApp('/parents')

    await user.click(
      await (await calendarSection()).findByRole('button', { name: 'Jetzt aktualisieren' }),
    )

    expect(calls.some((call) => call.key === 'POST /api/calendar/sync')).toBe(true)
  })
})

function makeCalendar(overrides: Partial<Calendar> = {}): Calendar {
  return {
    id: 1,
    name: 'mama@gmail.com',
    primary: true,
    selected: false,
    member_id: null,
    synced_at: '2026-09-25T10:00:00Z',
    sync_error: null,
    ...overrides,
  }
}

function withCalendars(calendars: Calendar[]): CalendarSettings {
  return {
    configured: true,
    redirect_uri: REDIRECT_URI,
    family_color: 'pink',
    connections: [
      {
        id: 1,
        provider: 'google',
        account_email: 'mama@gmail.com',
        status: 'ok',
        created_at: '2026-09-25T10:00:00Z',
        calendars,
      },
    ],
  }
}
