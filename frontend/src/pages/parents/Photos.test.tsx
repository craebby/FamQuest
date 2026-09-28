import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_FRAME_SETTINGS, type FrameSettings } from '../../api/frame'
import type { Photo } from '../../api/photos'
import i18n from '../../i18n'
import { makeMe, makePhoto, makeToday, mockApi, renderApp, setupDone } from '../../test/utils'

beforeEach(async () => {
  await i18n.changeLanguage('de')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function mockParents(photos: () => Photo[], extra = {}) {
  return mockApi({
    'GET /api/setup/status': setupDone,
    'GET /api/auth/me': Response.json(makeMe({ parent_unlocked: true })),
    'GET /api/members': Response.json([]),
    'GET /api/tasks': Response.json([]),
    'GET /api/rewards': Response.json([]),
    'GET /api/today': Response.json(makeToday()),
    'GET /api/photos': () => Response.json(photos()),
    'GET /api/frame/settings': Response.json(DEFAULT_FRAME_SETTINGS),
    ...extra,
  })
}

const file = (name: string) => new File(['x'], name, { type: 'image/jpeg' })

describe('Fotos im Elternbereich', () => {
  it('lädt mehrere Fotos nacheinander hoch und meldet Fehler je Datei', async () => {
    const user = userEvent.setup()
    let next = 1
    const calls = mockParents(() => [], {
      'POST /api/photos': () =>
        next === 2
          ? (next++, Response.json({ code: 'photo.invalid_image' }, { status: 422 }))
          : Response.json(makePhoto({ id: next++ }), { status: 201 }),
    })
    renderApp('/parents/photos')

    expect(await screen.findByText(/Noch keine Fotos/)).toBeVisible()
    await user.upload(screen.getByTestId('photos-input'), [
      file('a.jpg'),
      file('b.heic'),
      file('c.jpg'),
    ])

    expect(await screen.findByText('2 Fotos hochgeladen')).toBeVisible()
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('1 Foto konnte nicht hochgeladen werden')
    expect(alert).toHaveTextContent('b.heic: Das Foto konnte nicht gelesen werden')
    const uploads = calls.filter((call) => call.key === 'POST /api/photos')
    expect(uploads).toHaveLength(3)
    expect(uploads[0].body).toBeInstanceOf(Blob)
    expect(uploads[0].headers['X-CSRF-Token']).toBe('csrf-123')
  })

  it('blendet Fotos aus und zeigt das Aufnahmedatum', async () => {
    const user = userEvent.setup()
    let visible = true
    const calls = mockParents(() => [makePhoto({ visible })], {
      'PATCH /api/photos/1': (body: unknown) => {
        visible = (body as { visible: boolean }).visible
        return Response.json(makePhoto({ visible }))
      },
    })
    renderApp('/parents/photos')

    expect(await screen.findByRole('img', { name: 'Foto vom 24.12.2025' })).toBeVisible()
    await user.click(screen.getByRole('switch', { name: 'Zeigen' }))

    expect(await screen.findByText('Ausgeblendet')).toBeVisible()
    expect(screen.getByText(/1 ausgeblendet/)).toBeVisible()
    expect(calls.find((call) => call.key === 'PATCH /api/photos/1')?.body).toEqual({
      visible: false,
    })
  })

  it('löscht erst nach Rückfrage', async () => {
    const user = userEvent.setup()
    let photos = [makePhoto()]
    const calls = mockParents(() => photos, {
      'DELETE /api/photos/1': () => {
        photos = []
        return new Response(null, { status: 204 })
      },
    })
    renderApp('/parents/photos')

    const tile = (await screen.findByRole('img', { name: /Foto/ })).closest('li')!
    await user.click(within(tile).getByRole('button', { name: 'Löschen' }))
    expect(within(tile).getByText('Foto wirklich löschen?')).toBeVisible()
    expect(calls.some((call) => call.key === 'DELETE /api/photos/1')).toBe(false)

    await user.click(within(tile).getByRole('button', { name: 'Löschen' }))
    expect(await screen.findByText('Das Foto ist gelöscht.')).toBeVisible()
    expect(await screen.findByText(/Noch keine Fotos/)).toBeVisible()
  })
})

describe('Einstellungen des Bilderrahmens', () => {
  it('speichert Einblendungen und Anzeigedauer sofort', async () => {
    const user = userEvent.setup()
    // Wie der Server: GET liefert danach, was zuletzt gespeichert wurde.
    let saved: FrameSettings = DEFAULT_FRAME_SETTINGS
    const calls = mockParents(() => [], {
      'GET /api/frame/settings': () => Response.json(saved),
      'PUT /api/frame/settings': (body: unknown) => {
        saved = body as FrameSettings
        return Response.json(saved)
      },
    })
    renderApp('/parents/photos')

    const section = within(await screen.findByRole('region', { name: 'Bilderrahmen' }))
    // Standard: eine Minute, offene Aufgaben aus.
    expect(await section.findByRole('radio', { name: '1 Minute' })).toBeChecked()
    expect(section.getByRole('switch', { name: 'Offene Aufgaben' })).not.toBeChecked()

    await user.click(section.getByRole('switch', { name: 'Offene Aufgaben' }))
    expect(section.getByRole('switch', { name: 'Offene Aufgaben' })).toBeChecked()
    await user.click(section.getByRole('radio', { name: '30 Sekunden' }))

    const puts = calls.filter((call) => call.key === 'PUT /api/frame/settings')
    expect(puts.map((call) => call.body)).toEqual([
      { ...DEFAULT_FRAME_SETTINGS, show_tasks: true },
      { ...DEFAULT_FRAME_SETTINGS, show_tasks: true, photo_seconds: 30 },
    ])
  })

  it('stellt den Nachtmodus ein', async () => {
    const user = userEvent.setup()
    let saved: FrameSettings = DEFAULT_FRAME_SETTINGS
    const calls = mockParents(() => [], {
      'GET /api/frame/settings': () => Response.json(saved),
      'PUT /api/frame/settings': (body: unknown) => {
        saved = body as FrameSettings
        return Response.json(saved)
      },
    })
    renderApp('/parents/photos')

    const section = within(await screen.findByRole('region', { name: 'Bilderrahmen' }))
    const toggle = await section.findByRole('switch', { name: 'Nachtmodus einschalten' })
    expect(toggle).not.toBeChecked()
    // Zeiten und Darstellung erscheinen erst, wenn der Nachtmodus an ist.
    expect(section.queryByLabelText('Von')).not.toBeInTheDocument()

    await user.click(toggle)
    expect(section.getByLabelText('Von')).toHaveValue('22:00')
    expect(section.getByRole('radio', { name: 'Gedimmte Uhr' })).toBeChecked()
    await user.click(section.getByRole('radio', { name: 'Schwarz' }))
    fireEvent.change(section.getByLabelText('Bis'), { target: { value: '06:30' } })
    // Halb getippte Zeiten werden nicht gespeichert.
    fireEvent.change(section.getByLabelText('Von'), { target: { value: '' } })

    const puts = () => calls.filter((call) => call.key === 'PUT /api/frame/settings')
    await waitFor(() => expect(puts()).toHaveLength(3))
    expect(puts().map((call) => call.body)).toEqual([
      { ...DEFAULT_FRAME_SETTINGS, night_enabled: true },
      { ...DEFAULT_FRAME_SETTINGS, night_enabled: true, night_style: 'dark' },
      { ...DEFAULT_FRAME_SETTINGS, night_enabled: true, night_style: 'dark', night_end: '06:30' },
    ])
  })
})
