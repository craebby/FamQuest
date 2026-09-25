import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import i18n from '../i18n'
import { makeMe, mockApi, renderApp, setupDone } from '../test/utils'
import { PARENT_IDLE_TIMEOUT_MS } from './ParentsPage'

async function enterPin(user: ReturnType<typeof userEvent.setup>, pin: string) {
  for (const digit of pin) await user.click(screen.getByRole('button', { name: digit }))
  await user.click(screen.getByRole('button', { name: 'Bestätigen' }))
}

beforeEach(async () => {
  await i18n.changeLanguage('de')
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('Elternbereich', () => {
  it('ist über das Zahnrad erreichbar und verlangt die PIN', async () => {
    const user = userEvent.setup()
    mockApi({ 'GET /api/setup/status': setupDone, 'GET /api/auth/me': Response.json(makeMe()) })
    renderApp('/')

    await user.click(await screen.findByRole('link', { name: 'Elternbereich' }))

    expect(screen.getByRole('heading', { name: 'Eltern-PIN eingeben' })).toBeVisible()
  })

  it('meldet eine falsche PIN', async () => {
    const user = userEvent.setup()
    mockApi({
      'GET /api/setup/status': setupDone,
      'GET /api/auth/me': Response.json(makeMe()),
      'POST /api/parent/unlock': Response.json({ code: 'pin.wrong' }, { status: 403 }),
    })
    renderApp('/parents')

    await screen.findByRole('heading', { name: 'Eltern-PIN eingeben' })
    await enterPin(user, '0000')

    expect(await screen.findByRole('alert')).toHaveTextContent('Falsche PIN')
  })

  it('öffnet sich mit der richtigen PIN und sendet das CSRF-Token', async () => {
    const user = userEvent.setup()
    const calls = mockApi({
      'GET /api/setup/status': setupDone,
      'GET /api/auth/me': Response.json(makeMe()),
      'POST /api/parent/unlock': Response.json(makeMe({ parent_unlocked: true })),
    })
    renderApp('/parents')

    await screen.findByRole('heading', { name: 'Eltern-PIN eingeben' })
    await enterPin(user, '1234')

    expect(await screen.findByRole('heading', { name: 'Elternbereich' })).toBeVisible()
    const unlock = calls.find((call) => call.key === 'POST /api/parent/unlock')
    expect(unlock?.body).toEqual({ pin: '1234' })
    expect(unlock?.headers['X-CSRF-Token']).toBe('csrf-123')
  })

  it('kehrt nach Inaktivität zur Familienansicht zurück und sperrt', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const calls = mockApi({
      'GET /api/setup/status': setupDone,
      'GET /api/auth/me': Response.json(makeMe({ parent_unlocked: true })),
      'POST /api/parent/lock': Response.json(makeMe()),
    })
    renderApp('/parents')
    await screen.findByRole('heading', { name: 'Elternbereich' })

    await act(() => vi.advanceTimersByTimeAsync(PARENT_IDLE_TIMEOUT_MS + 100))

    expect(await screen.findByRole('heading', { name: 'Familienansicht' })).toBeVisible()
    expect(calls.some((call) => call.key === 'POST /api/parent/lock')).toBe(true)
  })
})
