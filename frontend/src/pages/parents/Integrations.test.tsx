import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ApiToken } from '../../api/integrations'
import i18n from '../../i18n'
import { makeMe, makeToday, mockApi, renderApp, setupDone } from '../../test/utils'

beforeEach(async () => {
  await i18n.changeLanguage('de')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const TOKEN: ApiToken = {
  id: 1,
  name: 'Kassenzettel-App',
  prefix: 'fq_Ab3d',
  scope: 'read',
  created_at: '2026-11-12T08:00:00Z',
  last_used_at: null,
}

function mockParents(tokens: () => ApiToken[], extra: Parameters<typeof mockApi>[0] = {}) {
  return mockApi({
    'GET /api/setup/status': setupDone,
    'GET /api/auth/me': Response.json(makeMe({ parent_unlocked: true })),
    'GET /api/members': Response.json([]),
    'GET /api/today': Response.json(makeToday()),
    'GET /api/integrations/tokens': () => Response.json(tokens()),
    'GET /api/integrations/printer': Response.json({ url: null, width: 32, app_url: null }),
    ...extra,
  })
}

async function section() {
  return within(
    (await screen.findByRole('heading', { name: 'Schnittstellen', level: 2 })).parentElement!,
  )
}

describe('Schnittstellen im Elternbereich', () => {
  it('legt einen Schlüssel an und zeigt ihn genau einmal', async () => {
    const user = userEvent.setup()
    let tokens: ApiToken[] = []
    const calls = mockParents(() => tokens, {
      'POST /api/integrations/tokens': (body) => {
        const created = { ...TOKEN, id: 2, ...(body as object) }
        tokens = [created]
        return Response.json({ ...created, token: 'fq_Ab3dGeheim' }, { status: 201 })
      },
    })
    renderApp('/parents/connections')

    const integrations = await section()
    const create = integrations.getByRole('button', { name: 'Schlüssel anlegen' })
    expect(create).toBeDisabled()
    await user.type(integrations.getByLabelText('Wofür ist der Schlüssel?'), 'Home Assistant')
    await user.click(integrations.getByRole('radio', { name: /Lesen und eintragen/ }))
    await user.click(create)

    expect(await integrations.findByText('fq_Ab3dGeheim')).toBeVisible()
    expect(calls.find((call) => call.key === 'POST /api/integrations/tokens')?.body).toEqual({
      name: 'Home Assistant',
      scope: 'write',
    })
    expect(await integrations.findByText(/noch nie benutzt/)).toBeVisible()

    await user.click(integrations.getByRole('button', { name: 'Fertig' }))
    expect(integrations.queryByText('fq_Ab3dGeheim')).not.toBeInTheDocument()
  })

  it('löscht einen Schlüssel erst nach Rückfrage', async () => {
    const user = userEvent.setup()
    let tokens = [TOKEN]
    const calls = mockParents(() => tokens, {
      'DELETE /api/integrations/tokens/1': () => {
        tokens = []
        return new Response(null, { status: 204 })
      },
    })
    renderApp('/parents/connections')

    const integrations = await section()
    await user.click(
      await integrations.findByRole('button', { name: 'Schlüssel „Kassenzettel-App“ löschen' }),
    )
    expect(calls.some((call) => call.key === 'DELETE /api/integrations/tokens/1')).toBe(false)
    await user.click(integrations.getByRole('button', { name: 'Wirklich löschen' }))

    expect(calls.some((call) => call.key === 'DELETE /api/integrations/tokens/1')).toBe(true)
    await vi.waitFor(() =>
      expect(integrations.queryByText('Kassenzettel-App')).not.toBeInTheDocument(),
    )
  })

  it('speichert die Adresse und Breite des Bon-Druckers', async () => {
    const user = userEvent.setup()
    const calls = mockParents(() => [], {
      'PUT /api/integrations/printer': (body) => Response.json(body),
    })
    renderApp('/parents/connections')

    const integrations = await section()
    await user.type(
      await integrations.findByLabelText('Adresse des Druckers'),
      'http://drucker.fritz.box:8090/print',
    )
    await user.click(integrations.getByRole('radio', { name: /48 Zeichen/ }))
    await user.type(
      integrations.getByLabelText('Adresse der Druck-App'),
      'http://druck.fritz.box:8200',
    )
    await user.click(integrations.getAllByRole('button', { name: 'Speichern' })[0])

    expect(await screen.findByText('Drucker gespeichert.')).toBeVisible()
    expect(calls.find((call) => call.key === 'PUT /api/integrations/printer')?.body).toEqual({
      url: 'http://drucker.fritz.box:8090/print',
      width: 48,
      app_url: 'http://druck.fritz.box:8200',
    })
  })
})
