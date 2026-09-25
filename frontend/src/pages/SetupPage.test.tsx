import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import i18n from '../i18n'
import { makeMe, mockApi, notAuthenticated, renderApp, setupRequired } from '../test/utils'

async function enterPin(user: ReturnType<typeof userEvent.setup>, pin: string) {
  for (const digit of pin) await user.click(screen.getByRole('button', { name: digit }))
  await user.click(screen.getByRole('button', { name: i18n.t('pinpad.confirm') }))
}

beforeEach(async () => {
  await i18n.changeLanguage('de')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Setup', () => {
  it('leitet beim ersten Start zur Einrichtung', async () => {
    mockApi({ 'GET /api/setup/status': setupRequired, 'GET /api/auth/me': notAuthenticated })

    renderApp('/')

    expect(await screen.findByRole('heading', { name: 'Willkommen bei FamQuest' })).toBeVisible()
  })

  it('prüft die Eingaben vor dem nächsten Schritt', async () => {
    const user = userEvent.setup()
    mockApi({ 'GET /api/setup/status': setupRequired })
    renderApp('/setup')

    await user.type(await screen.findByLabelText('E-Mail'), 'keine-mail')
    await user.type(screen.getByLabelText('Passwort'), 'kurz')
    await user.click(screen.getByRole('button', { name: 'Weiter' }))

    expect(screen.getByText('Bitte ausfüllen')).toBeVisible()
    expect(screen.getByText('Bitte eine gültige E-Mail-Adresse eingeben')).toBeVisible()
    expect(screen.getByText('Mindestens 10 Zeichen')).toBeVisible()
  })

  it('verlangt das Passwort ein zweites Mal', async () => {
    const user = userEvent.setup()
    mockApi({ 'GET /api/setup/status': setupRequired })
    renderApp('/setup')

    await user.type(await screen.findByLabelText('Familienname'), 'Familie Test')
    await user.type(screen.getByLabelText('E-Mail'), 'mama@example.org')
    await user.type(screen.getByLabelText('Passwort'), 'sehr-geheim-123')
    await user.type(screen.getByLabelText('Passwort wiederholen'), 'sehr-geheim-124')
    await user.click(screen.getByRole('button', { name: 'Weiter' }))

    expect(screen.getByLabelText('Passwort wiederholen')).toHaveAccessibleDescription(
      'Die Passwörter stimmen nicht überein',
    )
    expect(screen.queryByRole('heading', { name: 'Eltern-PIN festlegen' })).toBeNull()
  })

  it('richtet die Familie mit Sprache, Konto und PIN ein', async () => {
    const user = userEvent.setup()
    const calls = mockApi({
      'GET /api/setup/status': setupRequired,
      'POST /api/setup': Response.json(
        makeMe({ family: { ...makeMe().family, default_language: 'en' } }),
        {
          status: 201,
        },
      ),
    })
    renderApp('/setup')

    await user.click(await screen.findByRole('button', { name: 'English' }))
    expect(screen.getByRole('heading', { name: 'Welcome to FamQuest' })).toBeVisible()

    await user.type(screen.getByLabelText('Family name'), 'Familie Sonnenschein')
    await user.type(screen.getByLabelText('Email'), 'mama@example.org')
    await user.type(screen.getByLabelText('Password'), 'sehr-geheim-123')
    await user.type(screen.getByLabelText('Repeat password'), 'sehr-geheim-123')
    await user.click(screen.getByRole('button', { name: 'Next' }))

    expect(screen.getByRole('heading', { name: 'Choose a parent PIN' })).toBeVisible()
    await enterPin(user, '1234')
    expect(screen.getByRole('heading', { name: 'Repeat the parent PIN' })).toBeVisible()
    await enterPin(user, '1234')

    expect(await screen.findByRole('heading', { name: 'Familie Sonnenschein' })).toBeVisible()
    const setupCall = calls.find((call) => call.key === 'POST /api/setup')
    expect(setupCall?.body).toMatchObject({
      language: 'en',
      family_name: 'Familie Sonnenschein',
      email: 'mama@example.org',
      password: 'sehr-geheim-123',
      pin: '1234',
    })
  })

  it('verlangt die PIN erneut, wenn die Wiederholung abweicht', async () => {
    const user = userEvent.setup()
    mockApi({ 'GET /api/setup/status': setupRequired })
    renderApp('/setup')

    await user.type(await screen.findByLabelText('Familienname'), 'Familie Test')
    await user.type(screen.getByLabelText('E-Mail'), 'mama@example.org')
    await user.type(screen.getByLabelText('Passwort'), 'sehr-geheim-123')
    await user.type(screen.getByLabelText('Passwort wiederholen'), 'sehr-geheim-123')
    await user.click(screen.getByRole('button', { name: 'Weiter' }))
    await enterPin(user, '1234')
    await enterPin(user, '9999')

    expect(screen.getByRole('heading', { name: 'Eltern-PIN festlegen' })).toBeVisible()
    expect(screen.getByRole('alert')).toHaveTextContent('Die PINs stimmen nicht überein')
  })
})
