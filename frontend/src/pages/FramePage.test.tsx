import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Photo } from '../api/photos'
import { FRAME_IDLE_STORAGE_KEY } from '../frameIdle'
import i18n from '../i18n'
import {
  makeMe,
  makeMember,
  makePhoto,
  makeToday,
  mockApi,
  renderApp,
  setupDone,
} from '../test/utils'
import { PHOTO_DURATION_MS } from './frame/slideshow'

beforeEach(async () => {
  await i18n.changeLanguage('de')
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  localStorage.clear()
})

function mockFrame(photos: Photo[]) {
  return mockApi({
    'GET /api/setup/status': setupDone,
    'GET /api/auth/me': Response.json(makeMe()),
    'GET /api/members': Response.json([makeMember()]),
    'GET /api/today': Response.json(makeToday()),
    'GET /api/photos': Response.json(photos),
  })
}

/** Das Foto der obersten Ebene, also das gerade eingeblendete. */
function currentPhotoSrc() {
  const layers = screen.getAllByTestId('frame-photo')
  const images = layers.at(-1)!.querySelectorAll('img')
  return images[images.length - 1].getAttribute('src')
}

describe('Bilderrahmen', () => {
  it('zeigt nur sichtbare Fotos und wechselt nach der Anzeigedauer', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockFrame([makePhoto({ id: 1 }), makePhoto({ id: 2, visible: false }), makePhoto({ id: 3 })])
    renderApp('/frame')

    await screen.findByTestId('frame-photo')
    const first = currentPhotoSrc()
    expect(['/api/photo-files/1.webp', '/api/photo-files/3.webp']).toContain(first)
    // Die Navigationsleiste gehört nicht zum Vollbild.
    expect(screen.queryByRole('navigation', { name: 'Hauptnavigation' })).not.toBeInTheDocument()

    await act(() => vi.advanceTimersByTimeAsync(PHOTO_DURATION_MS + 100))
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
