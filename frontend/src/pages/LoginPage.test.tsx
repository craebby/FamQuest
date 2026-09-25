import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import i18n from '../i18n'
import { makeMe, mockApi, notAuthenticated, renderApp, setupDone } from '../test/utils'

beforeEach(async () => {
  await i18n.changeLanguage('de')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Login', () => {
  it('leitet ohne Anmeldung zum Login', async () => {
    mockApi({ 'GET /api/setup/status': setupDone, 'GET /api/auth/me': notAuthenticated })

    renderApp('/parents')

    expect(await screen.findByRole('heading', { name: 'Anmelden' })).toBeVisible()
  })

  it.each([
    ['de', 'E-Mail', 'Passwort', 'Anmelden', 'E-Mail oder Passwort ist falsch'],
    ['en', 'Email', 'Password', 'Sign in', 'Email or password is incorrect'],
  ])(
    'zeigt falsche Zugangsdaten übersetzt an (%s)',
    async (language, email, password, submit, message) => {
      await i18n.changeLanguage(language)
      const user = userEvent.setup()
      mockApi({
        'GET /api/setup/status': setupDone,
        'GET /api/auth/me': notAuthenticated,
        'POST /api/auth/login': Response.json(
          { code: 'auth.invalid_credentials' },
          { status: 401 },
        ),
      })
      renderApp('/login')

      await user.type(await screen.findByLabelText(email), 'mama@example.org')
      await user.type(screen.getByLabelText(password), 'falsch-falsch')
      await user.click(screen.getByRole('button', { name: submit }))

      expect(await screen.findByRole('alert')).toHaveTextContent(message)
    },
  )

  it('meldet an und übernimmt die Sprache der Familie', async () => {
    const user = userEvent.setup()
    const me = makeMe({ family: { ...makeMe().family, default_language: 'en' } })
    let loggedIn = false
    mockApi({
      'GET /api/setup/status': setupDone,
      'GET /api/auth/me': () => (loggedIn ? Response.json(me) : notAuthenticated.clone()),
      'POST /api/auth/login': () => {
        loggedIn = true
        return Response.json(me)
      },
    })
    renderApp('/login')

    await user.type(await screen.findByLabelText('E-Mail'), 'mama@example.org')
    await user.type(screen.getByLabelText('Passwort'), 'sehr-geheim-123')
    await user.click(screen.getByRole('button', { name: 'Anmelden' }))

    expect(await screen.findByRole('link', { name: 'Today' })).toBeVisible()
    expect(document.documentElement.lang).toBe('en')
  })
})
