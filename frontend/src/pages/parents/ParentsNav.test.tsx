import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import i18n from '../../i18n'
import { makeMe, makeMember, makeToday, mockApi, renderApp, setupDone } from '../../test/utils'

function api(pending = 0) {
  return mockApi({
    'GET /api/setup/status': setupDone,
    'GET /api/auth/me': Response.json(makeMe({ parent_unlocked: true })),
    'GET /api/members': Response.json([makeMember()]),
    'GET /api/tasks': Response.json([]),
    'GET /api/rewards': Response.json([]),
    'GET /api/today': Response.json(makeToday({ pending_approvals: pending })),
  })
}

// Im Test sind beide Leisten im Dokument (CSS blendet am Gerät eine davon aus):
// zuerst die Leiste links (Tablet), dann die untere (Handy).
const sidebar = () => screen.getAllByRole('navigation', { name: 'Bereiche des Elternbereichs' })[0]
const bottomBar = () =>
  screen.getAllByRole('navigation', { name: 'Bereiche des Elternbereichs' })[1]

beforeEach(async () => {
  await i18n.changeLanguage('de')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Menü im Elternbereich', () => {
  it('startet mit „Prüfen & Punkte“ und wechselt über die Leiste links', async () => {
    const user = userEvent.setup()
    api()
    renderApp('/parents')

    expect(await screen.findByRole('heading', { name: 'Punkte' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Aufgaben' })).toBeNull()
    expect(within(sidebar()).getAllByRole('link')).toHaveLength(8)

    await user.click(within(sidebar()).getByRole('link', { name: 'Aufgaben' }))
    expect(await screen.findByRole('heading', { name: 'Aufgaben' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Punkte' })).toBeNull()
    expect(within(sidebar()).getByRole('link', { name: 'Aufgaben' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('zeigt wartende Kontrollen als Zahl', async () => {
    api(2)
    renderApp('/parents/tasks')

    await screen.findByRole('heading', { name: 'Aufgaben' })
    expect(
      await within(sidebar()).findByRole('link', {
        name: 'Prüfen & Punkte, 2 Aufgaben warten auf Kontrolle',
      }),
    ).toHaveAttribute('href', '/parents/review')
  })

  it('am Handy: vier Bereiche unten, der Rest hinter „Mehr“', async () => {
    const user = userEvent.setup()
    api()
    renderApp('/parents/tasks')

    await screen.findByRole('heading', { name: 'Aufgaben' })
    const bar = within(bottomBar())
    expect(bar.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      '/parents/review',
      '/parents/tasks',
      '/parents/routines',
      '/parents/rewards',
    ])
    const more = bar.getByRole('button', { name: 'Mehr' })
    expect(more).toHaveAttribute('aria-expanded', 'false')

    await user.click(more)
    expect(more).toHaveAttribute('aria-expanded', 'true')
    await user.click(bar.getByRole('link', { name: 'Einstellungen' }))

    expect(await screen.findByRole('heading', { name: 'Eltern-PIN' })).toBeVisible()
    expect(more).toHaveAttribute('aria-expanded', 'false')
    expect(bar.queryByRole('link', { name: 'Einstellungen' })).toBeNull()
  })

  it('führt bei unbekanntem Bereich zum Start des Elternbereichs', async () => {
    api()
    renderApp('/parents/gibtsnicht')

    expect(await screen.findByRole('heading', { name: 'Punkte' })).toBeVisible()
  })
})
