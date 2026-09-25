import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DISPLAY_SIZE_STORAGE_KEY, applyDisplaySize } from '../../displaySize'
import i18n from '../../i18n'
import { makeMe, makeToday, mockApi, renderApp, setupDone } from '../../test/utils'

beforeEach(async () => {
  await i18n.changeLanguage('de')
  localStorage.clear()
  applyDisplaySize()
})

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
  applyDisplaySize()
})

describe('Einstellungen für dieses Gerät', () => {
  it('speichert die Anzeigegröße nur auf dem Gerät und zeigt die Anzeige-Info', async () => {
    const user = userEvent.setup()
    mockApi({
      'GET /api/setup/status': setupDone,
      'GET /api/auth/me': Response.json(makeMe({ parent_unlocked: true })),
      'GET /api/members': Response.json([]),
      'GET /api/tasks': Response.json([]),
      'GET /api/rewards': Response.json([]),
      'GET /api/approvals': Response.json([]),
      'GET /api/today': Response.json(makeToday()),
    })
    renderApp('/parents')

    expect(await screen.findByRole('radio', { name: 'Normal' })).toBeChecked()
    expect(screen.getByTestId('display-info')).toHaveTextContent(/^Anzeige: \d+ × \d+ px/)

    await user.click(screen.getByRole('radio', { name: 'Klein' }))
    expect(document.documentElement.dataset.size).toBe('small')
    expect(localStorage.getItem(DISPLAY_SIZE_STORAGE_KEY)).toBe('small')

    await user.click(screen.getByRole('radio', { name: 'Normal' }))
    expect(document.documentElement.dataset.size).toBeUndefined()
    expect(localStorage.getItem(DISPLAY_SIZE_STORAGE_KEY)).toBeNull()
  })
})
