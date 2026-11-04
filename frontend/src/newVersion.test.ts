import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

import { RELOAD_IDLE_MS, VERSION_CHECK_MS, appScript, useReloadOnNewVersion } from './newVersion'

const page = (script: string) =>
  `<!doctype html><html><head><script type="module" crossorigin src="${script}"></script></head></html>`

describe('neue Version', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    document.head.innerHTML = ''
  })

  it('findet das Skript der App in der Startseite', () => {
    expect(appScript(page('/assets/index-abc123.js'))).toBe('/assets/index-abc123.js')
    expect(appScript('<script type="module" src="/src/main.tsx"></script>')).toBeNull()
  })

  it('lädt nach einer neuen Version neu, aber erst wenn niemand tippt', async () => {
    vi.useFakeTimers()
    document.head.innerHTML = page('/assets/index-alt.js').replace(/.*<head>|<\/head>.*/g, '')
    const fetchMock = vi.fn(() => Promise.resolve(new Response(page('/assets/index-neu.js'))))
    vi.stubGlobal('fetch', fetchMock)
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })

    renderHook(() => useReloadOnNewVersion(true))
    await vi.advanceTimersByTimeAsync(VERSION_CHECK_MS)
    expect(fetchMock).toHaveBeenCalledOnce()

    await vi.advanceTimersByTimeAsync(RELOAD_IDLE_MS - 1000)
    window.dispatchEvent(new Event('pointerdown'))
    await vi.advanceTimersByTimeAsync(RELOAD_IDLE_MS - 1000)
    expect(reload).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1000)
    expect(reload).toHaveBeenCalledOnce()
  })

  it('bleibt bei derselben Version und ohne Netz still', async () => {
    vi.useFakeTimers()
    document.head.innerHTML = page('/assets/index-alt.js').replace(/.*<head>|<\/head>.*/g, '')
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockImplementation(() => Promise.resolve(new Response(page('/assets/index-alt.js'))))
    vi.stubGlobal('fetch', fetchMock)
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })

    renderHook(() => useReloadOnNewVersion(true))
    await vi.advanceTimersByTimeAsync(2 * VERSION_CHECK_MS + RELOAD_IDLE_MS)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(reload).not.toHaveBeenCalled()
  })
})
