import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_FRAME_SETTINGS, type FrameSettings } from '../api/frame'
import type { MealWeek } from '../api/meals'
import i18n from '../i18n'
import {
  makeChorePlan,
  makeMe,
  makeMember,
  makeToday,
  makeTodayTask,
  makeTodo,
  mockApi,
  notAuthenticated,
  renderApp,
  setupDone,
} from '../test/utils'
import { KITCHEN_DAYS } from './KitchenPage'

beforeEach(async () => {
  await i18n.changeLanguage('de')
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

// Heute ist Samstag, 3. Oktober.
const MEALS: MealWeek = {
  start: '2026-09-28',
  today: '2026-10-03',
  meals: ['dinner'],
  entries: [
    {
      date: '2026-10-03',
      meal: 'dinner',
      dish_id: 1,
      name: 'Fischstäbchen',
      icon: 'fluent-emoji-flat:fish',
      image_url: null,
      note: null,
      variant: null,
    },
  ],
}

function mockKitchen(
  settings: Partial<FrameSettings> = {},
  extra: Parameters<typeof mockApi>[0] = {},
) {
  return mockApi({
    'GET /api/setup/status': setupDone,
    'GET /api/auth/me': Response.json(makeMe()),
    'GET /api/members': Response.json([makeMember()]),
    'GET /api/today': Response.json(makeToday({ tasks: [makeTodayTask({ id: 10 })] })),
    'GET /api/weather': Response.json({ place: null, current: null, days: [] }),
    'GET /api/calendar/status': Response.json({ enabled: false }),
    'GET /api/meals/week': Response.json(MEALS),
    'GET /api/dishes': Response.json([]),
    'GET /api/shopping/list': Response.json({
      items: [
        {
          id: 1,
          name: 'Milch',
          icon: 'fluent-emoji-flat:glass-of-milk',
          note: null,
          checked: false,
        },
      ],
    }),
    'GET /api/shopping/items': Response.json([]),
    'GET /api/chores': Response.json(makeChorePlan({ todos: [makeTodo({ id: 7 })] })),
    'GET /api/frame/settings': Response.json({ ...DEFAULT_FRAME_SETTINGS, ...settings }),
    ...extra,
  })
}

const page = async (name: string) => within(await screen.findByRole('region', { name }))

describe('Küchenansicht', () => {
  it('zeigt ohne Navigationsleiste die nächsten Tage mit Terminen und Essen', async () => {
    mockKitchen()
    renderApp('/kitchen')

    const week = await page('Termine und Essen')
    expect(
      await week.findByRole('button', { name: 'Abendessen: Fischstäbchen, ändern' }),
    ).toBeVisible()
    // Heute und die nächsten Tage, nicht die ganze Woche.
    expect(week.getByRole('region', { name: 'Samstag, 3. Oktober' })).toHaveAttribute(
      'aria-current',
      'date',
    )
    expect(week.getAllByRole('button', { name: 'Abendessen eintragen' })).toHaveLength(
      KITCHEN_DAYS - 1,
    )
    expect(screen.queryByRole('navigation', { name: 'Hauptnavigation' })).toBeNull()
  })

  it('hat daneben Aufgaben, Haushalt und Einkauf; die Symbole oben springen hin', async () => {
    const user = userEvent.setup()
    mockKitchen()
    renderApp('/kitchen')

    const tabs = within(await screen.findByRole('navigation', { name: 'Seiten der Küchenansicht' }))
    expect(tabs.getByRole('button', { name: 'Termine und Essen' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(
      await (await page('Aufgaben')).findByRole('button', { name: /Zähne putzen/ }),
    ).toBeVisible()
    expect(
      await (await page('Haushalt')).findByRole('button', { name: 'Hühnerfutter holen' }),
    ).toBeVisible()
    expect(await (await page('Einkauf')).findByText('Milch')).toBeVisible()
    // Aus der Küche führt kein Pfeil in die große Aufgabenansicht.
    expect(screen.queryByRole('link', { name: 'Alle Aufgaben öffnen' })).toBeNull()

    await user.click(tabs.getByRole('button', { name: 'Einkauf' }))
    expect(tabs.getByRole('button', { name: 'Einkauf' })).toHaveAttribute('aria-current', 'page')
    expect(tabs.getByRole('button', { name: 'Termine und Essen' })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('zeigt im Nachtfenster des Bilderrahmens den Nachtbildschirm; ein Tipp weckt', async () => {
    const user = userEvent.setup()
    // Rund um die Uhr Nacht, damit der Test nicht von der Uhrzeit abhängt.
    mockKitchen({ night_enabled: true, night_start: '00:00', night_end: '23:59' })
    renderApp('/kitchen')

    const wake = await screen.findByRole('button', { name: 'Bildschirm aufwecken' })
    expect(within(wake).getByTestId('frame-night')).toBeInTheDocument()

    await user.click(wake)
    expect(screen.queryByRole('button', { name: 'Bildschirm aufwecken' })).toBeNull()
  })

  it('führt nach dem Anmelden zurück in die Küchenansicht', async () => {
    const user = userEvent.setup()
    let signedIn = false
    mockKitchen(
      {},
      {
        'GET /api/auth/me': () => (signedIn ? Response.json(makeMe()) : notAuthenticated.clone()),
        'POST /api/auth/login': () => {
          signedIn = true
          return Response.json(makeMe())
        },
      },
    )
    renderApp('/kitchen')

    await user.type(await screen.findByLabelText('E-Mail'), 'mama@example.org')
    await user.type(screen.getByLabelText('Passwort'), 'sehr-geheim-123')
    await user.click(screen.getByRole('button', { name: 'Anmelden' }))

    expect(
      await screen.findByRole('navigation', { name: 'Seiten der Küchenansicht' }),
    ).toBeVisible()
  })

  it('legt nur auf der ersten Seite neue Termine an; vorhandene bleiben nur lesbar', async () => {
    const user = userEvent.setup()
    const calendar = { id: 8, name: 'Familie', member_id: null, person_choices: [] }
    const event = {
      key: '5',
      title: 'Schwimmen',
      start: '2026-10-03T13:00:00Z',
      end: '2026-10-03T14:00:00Z',
      all_day: false,
      location: null,
      description: null,
      calendars: ['Familie'],
      member_ids: [],
      family: true,
      recurring: false,
      editable: true,
      person_choices: [],
      icon: null,
      continues_before: false,
      continues_after: false,
    }
    const calls = mockKitchen(
      {},
      {
        'GET /api/calendar/status': Response.json({ enabled: true }),
        'GET /api/calendar/week': Response.json({
          start: '2026-09-28',
          today: '2026-10-03',
          timezone: 'Europe/Berlin',
          family_color: 'pink',
          problem: false,
          writable_calendars: [calendar],
          days: [{ date: '2026-10-03', holidays: [], events: [event] }],
        }),
        'POST /api/parent/unlock': Response.json(makeMe({ parent_unlocked: true })),
        'POST /api/calendar/events': () => new Response(null, { status: 204 }),
      },
    )
    renderApp('/kitchen')

    const week = await page('Termine und Essen')
    await user.click(await week.findByRole('button', { name: /Schwimmen/ }))
    const details = within(await screen.findByRole('dialog', { name: 'Schwimmen' }))
    expect(details.queryByRole('button', { name: 'Termin bearbeiten' })).toBeNull()
    expect(details.queryByRole('button', { name: 'Termin löschen' })).toBeNull()
    await user.click(details.getByRole('button', { name: 'Schließen' }))

    await user.click(await screen.findByRole('button', { name: 'Neuer Termin' }))
    for (const digit of ['1', '2', '3', '4']) {
      await user.click(await screen.findByRole('button', { name: digit }))
    }
    await user.click(screen.getByRole('button', { name: 'Bestätigen' }))
    await user.type(await screen.findByLabelText('Titel'), 'Zahnarzt')
    await user.click(screen.getByRole('button', { name: 'Speichern' }))
    await vi.waitFor(() => {
      expect(calls.find((call) => call.key === 'POST /api/calendar/events')?.body).toMatchObject({
        calendar_id: 8,
        title: 'Zahnarzt',
        start_date: '2026-10-03',
      })
    })

    const tabs = within(screen.getByRole('navigation', { name: 'Seiten der Küchenansicht' }))
    await user.click(tabs.getByRole('button', { name: 'Einkauf' }))
    expect(screen.queryByRole('button', { name: 'Neuer Termin' })).toBeNull()
  })
})
