import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CalendarUpcoming } from '../api/calendar'
import { DEFAULT_FRAME_SETTINGS, type FrameSettings } from '../api/frame'
import type { Photo } from '../api/photos'
import { FRAME_IDLE_STORAGE_KEY } from '../frameIdle'
import i18n from '../i18n'
import {
  makeMe,
  makeMember,
  makePhoto,
  makeToday,
  makeTodayTask,
  mockApi,
  renderApp,
  setupDone,
} from '../test/utils'
import { TASKS_PER_MEMBER } from './frame/Overlays'

beforeEach(async () => {
  await i18n.changeLanguage('de')
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  localStorage.clear()
})

function mockFrame(
  photos: Photo[],
  settings: Partial<FrameSettings> = {},
  extra: Parameters<typeof mockApi>[0] = {},
) {
  return mockApi({
    'GET /api/setup/status': setupDone,
    'GET /api/auth/me': Response.json(makeMe()),
    'GET /api/members': Response.json([makeMember()]),
    'GET /api/today': Response.json(makeToday()),
    'GET /api/photos': Response.json(photos),
    'GET /api/frame/settings': Response.json({ ...DEFAULT_FRAME_SETTINGS, ...settings }),
    ...extra,
  })
}

const UPCOMING: CalendarUpcoming = {
  today: '2026-10-03',
  timezone: 'Europe/Berlin',
  family_color: 'pink',
  problem: false,
  holidays: [],
  events: [
    {
      key: '1',
      title: 'Schwimmen',
      all_day: false,
      // 15:00 bis 16:00 in Berlin, am nächsten Tag.
      start: '2026-10-04T13:00:00Z',
      end: '2026-10-04T14:00:00Z',
      location: null,
      description: null,
      calendars: ['Lena'],
      member_ids: [1],
      family: false,
      continues_before: false,
      continues_after: false,
      day: '2026-10-04',
    },
  ],
}

/** Das Foto der obersten Ebene, also das gerade eingeblendete. */
function currentPhotoSrc() {
  const layers = screen.getAllByTestId('frame-photo')
  const images = layers.at(-1)!.querySelectorAll('img')
  return images[images.length - 1].getAttribute('src')
}

describe('Bilderrahmen', () => {
  it('zeigt nur sichtbare Fotos und wechselt nach der eingestellten Anzeigedauer', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockFrame([makePhoto({ id: 1 }), makePhoto({ id: 2, visible: false }), makePhoto({ id: 3 })], {
      photo_seconds: 30,
    })
    renderApp('/frame')

    await screen.findByTestId('frame-photo')
    const first = currentPhotoSrc()
    expect(['/api/photo-files/1.webp', '/api/photo-files/3.webp']).toContain(first)
    // Die Navigationsleiste gehört nicht zum Vollbild.
    expect(screen.queryByRole('navigation', { name: 'Hauptnavigation' })).not.toBeInTheDocument()

    await act(() => vi.advanceTimersByTimeAsync(29 * 1000))
    expect(currentPhotoSrc()).toBe(first)
    await act(() => vi.advanceTimersByTimeAsync(1000 + 100))
    const second = currentPhotoSrc()
    expect(second).not.toBe(first)
    expect(['/api/photo-files/1.webp', '/api/photo-files/3.webp']).toContain(second)
  })

  it('zeigt Hochformat ganz mit unscharfem Hintergrund', async () => {
    mockFrame([makePhoto({ width: 1440, height: 2560 })])
    renderApp('/frame')

    const layer = await screen.findByTestId('frame-photo')
    const [background, photo] = layer.querySelectorAll('img')
    expect(background).toHaveAttribute('src', '/api/photo-files/1-thumb.webp')
    expect(background).toHaveClass('blur-2xl')
    expect(photo).toHaveClass('object-contain')
  })

  it('führt mit einem Tipp zu „Heute“', async () => {
    const user = userEvent.setup()
    mockFrame([makePhoto()])
    renderApp('/frame')

    await screen.findByTestId('frame-photo')
    await user.click(screen.getByRole('button', { name: /Bilderrahmen beenden/ }))
    expect(await screen.findByRole('navigation', { name: 'Hauptnavigation' })).toBeVisible()
    expect(screen.queryByTestId('frame-photo')).not.toBeInTheDocument()
  })

  it('erklärt, wie Fotos dazukommen, wenn keine sichtbar sind', async () => {
    mockFrame([makePhoto({ visible: false })])
    renderApp('/frame')

    expect(await screen.findByText(/Noch keine Fotos/)).toBeVisible()
    expect(screen.queryByTestId('frame-photo')).not.toBeInTheDocument()
  })
})

describe('Einblendungen im Bilderrahmen', () => {
  it('zeigt Uhr, Wetter, nächsten Termin und offene Aufgaben', async () => {
    const open = Array.from({ length: TASKS_PER_MEMBER + 2 }, (_, index) =>
      makeTodayTask({ id: index + 1, title: `Aufgabe ${index + 1}` }),
    )
    const done = makeTodayTask({ id: 50, done_member_ids: [1] })
    const extra = makeTodayTask({ id: 51, extra: true })
    mockFrame(
      [makePhoto()],
      { show_tasks: true },
      {
        'GET /api/members': Response.json([
          makeMember(),
          makeMember({ id: 2, name: 'Papa', role: 'parent', color: 'blue' }),
        ]),
        'GET /api/today': Response.json(makeToday({ tasks: [...open, done, extra] })),
        'GET /api/weather': Response.json({
          place: { name: 'Köln', latitude: 50.94, longitude: 6.96 },
          current: { temperature: 12.4, code: 61, is_day: true },
          days: [],
          stale: false,
        }),
        'GET /api/calendar/upcoming': Response.json(UPCOMING),
      },
    )
    renderApp('/frame')

    const overlays = within(await screen.findByTestId('frame-overlays'))
    expect(overlays.getByText(/^\d{1,2}:\d{2}$/)).toBeInTheDocument()
    expect(await overlays.findByText('12°')).toBeInTheDocument()
    expect(await overlays.findByText('Schwimmen')).toBeInTheDocument()
    expect(overlays.getByText(/Morgen, 15:00/)).toBeInTheDocument()
    // Nur Lena hat offene Aufgaben: erledigte und Extras zählen nicht, Papa hat keine.
    const lena = await overlays.findByRole('listitem', { name: 'Lena: 6 Aufgaben offen' })
    expect(within(lena).getByText('+2')).toBeInTheDocument()
    expect(overlays.queryByRole('listitem', { name: /Papa/ })).not.toBeInTheDocument()
  })

  it('lässt ausgeschaltete Einblendungen weg', async () => {
    mockFrame([makePhoto()], {
      show_clock: false,
      show_weather: false,
      show_event: false,
      show_tasks: false,
    })
    renderApp('/frame')

    await screen.findByTestId('frame-photo')
    expect(screen.queryByTestId('frame-overlays')).not.toBeInTheDocument()
  })

  it('beendet den Bilderrahmen auch mit Einblendungen per Tipp', async () => {
    const user = userEvent.setup()
    mockFrame([makePhoto()], { show_tasks: true })
    renderApp('/frame')

    const overlays = await screen.findByTestId('frame-overlays')
    expect(overlays).toHaveClass('pointer-events-none')
    await user.click(screen.getByRole('button', { name: /Bilderrahmen beenden/ }))
    expect(await screen.findByRole('navigation', { name: 'Hauptnavigation' })).toBeVisible()
  })
})

describe('Start des Bilderrahmens', () => {
  it('zeigt das Symbol nur mit sichtbaren Fotos', async () => {
    mockFrame([makePhoto({ visible: false })])
    renderApp('/tasks')
    await screen.findByRole('navigation', { name: 'Hauptnavigation' })
    expect(screen.queryByRole('link', { name: 'Fotos' })).not.toBeInTheDocument()
  })

  it('startet per Symbol in der Leiste', async () => {
    const user = userEvent.setup()
    mockFrame([makePhoto()])
    renderApp('/tasks')

    await user.click(await screen.findByRole('link', { name: 'Fotos' }))
    expect(await screen.findByTestId('frame-photo')).toBeInTheDocument()
  })

  it('startet nach Leerlauf nur, wenn es auf dem Gerät eingeschaltet ist', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockFrame([makePhoto()])
    const view = renderApp('/tasks')
    await screen.findByRole('link', { name: 'Fotos' })
    await act(() => vi.advanceTimersByTimeAsync(31 * 60 * 1000))
    expect(screen.queryByTestId('frame-photo')).not.toBeInTheDocument()
    view.unmount()

    localStorage.setItem(FRAME_IDLE_STORAGE_KEY, '5')
    renderApp('/tasks')
    await screen.findByRole('link', { name: 'Fotos' })
    await act(() => vi.advanceTimersByTimeAsync(4 * 60 * 1000))
    expect(screen.queryByTestId('frame-photo')).not.toBeInTheDocument()
    await act(() => vi.advanceTimersByTimeAsync(60 * 1000 + 100))
    expect(await screen.findByTestId('frame-photo')).toBeInTheDocument()
  })
})
