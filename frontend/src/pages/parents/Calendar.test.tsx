import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CalendarSettings } from '../../api/calendar'
import i18n from '../../i18n'
import { makeMe, makeToday, mockApi, renderApp, setupDone } from '../../test/utils'

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
    mockParents({ configured: false, redirect_uri: REDIRECT_URI, connections: [] })
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
      { configured: true, redirect_uri: REDIRECT_URI, connections: [] },
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
        connections: [
          {
            id: 1,
            provider: 'google',
            account_email: 'mama@gmail.com',
            status: 'ok',
            created_at: '2026-09-25T10:00:00Z',
          },
          {
            id: 2,
            provider: 'google',
            account_email: 'papa@gmail.com',
            status: 'reconnect',
            created_at: '2026-09-25T10:00:00Z',
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
    mockParents({ configured: true, redirect_uri: REDIRECT_URI, connections: [] })
    renderApp('/parents?calendar_error=calendar.scope_missing')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Der Zugriff auf den Kalender wurde nicht erlaubt',
    )
  })

  it('bestätigt eine erfolgreiche Verbindung', async () => {
    mockParents({ configured: true, redirect_uri: REDIRECT_URI, connections: [] })
    renderApp('/parents?calendar=connected')

    expect(await screen.findByText('Google-Konto verbunden')).toBeVisible()
  })
})
