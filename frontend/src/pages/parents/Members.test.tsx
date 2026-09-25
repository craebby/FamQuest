import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import i18n from '../../i18n'
import { makeMe, makeMember, mockApi, renderApp, setupDone } from '../../test/utils'

// Der echte Cropper braucht Layout und Canvas, die jsdom nicht hat.
vi.mock('../../components/AvatarCropper', () => ({
  AvatarCropper: ({ onConfirm }: { onConfirm: (image: Blob) => void }) => (
    <button type="button" onClick={() => onConfirm(new Blob(['x'], { type: 'image/webp' }))}>
      Zuschnitt fertig
    </button>
  ),
}))

const unlocked = { 'GET /api/setup/status': setupDone }
const me = () => Response.json(makeMe({ parent_unlocked: true }))

beforeEach(async () => {
  await i18n.changeLanguage('de')
  URL.createObjectURL = vi.fn(() => 'blob:vorschau')
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Familienmitglieder im Elternbereich', () => {
  it('zeigt einen Hinweis, solange niemand angelegt ist', async () => {
    mockApi({ ...unlocked, 'GET /api/auth/me': me(), 'GET /api/members': Response.json([]) })
    renderApp('/parents')

    expect(await screen.findByText(/Noch niemand angelegt/)).toBeVisible()
  })

  it('listet Personen mit Rolle und öffnet sie zum Bearbeiten', async () => {
    const user = userEvent.setup()
    mockApi({
      ...unlocked,
      'GET /api/auth/me': me(),
      'GET /api/members': Response.json([
        makeMember(),
        makeMember({ id: 2, name: 'Papa', role: 'parent', color: 'blue' }),
      ]),
    })
    renderApp('/parents')

    await user.click(await screen.findByRole('button', { name: 'Papa bearbeiten' }))

    expect(screen.getByRole('heading', { name: 'Papa bearbeiten' })).toBeVisible()
    expect(screen.getByLabelText('Name')).toHaveValue('Papa')
    expect(screen.getByRole('radio', { name: 'Elternteil' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Blau' })).toBeChecked()
  })

  it('legt eine Person mit freier Farbe und Foto an', async () => {
    const user = userEvent.setup()
    const calls = mockApi({
      ...unlocked,
      'GET /api/auth/me': me(),
      'GET /api/members': Response.json([makeMember()]),
      'POST /api/members': Response.json(makeMember({ id: 2, name: 'Tom', color: 'green' }), {
        status: 201,
      }),
      'PUT /api/members/2/avatar': Response.json(
        makeMember({ id: 2, name: 'Tom', color: 'green' }),
      ),
    })
    renderApp('/parents')

    await user.click(await screen.findByRole('button', { name: 'Person hinzufügen' }))
    await user.type(screen.getByLabelText('Name'), '  Tom ')
    const taken = screen.getByRole('radio', { name: 'Lila (schon vergeben an Lena)' })
    expect(taken).toBeDisabled()
    await user.click(screen.getByRole('radio', { name: 'Grün' }))
    await user.upload(
      screen.getByTestId('photo-input'),
      new File(['foto'], 'tom.jpg', { type: 'image/jpeg' }),
    )
    await user.click(screen.getByRole('button', { name: 'Zuschnitt fertig' }))
    await user.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Tom ist gespeichert.')
    const create = calls.find((call) => call.key === 'POST /api/members')
    expect(create?.body).toEqual({ name: 'Tom', role: 'child', color: 'green' })
    const avatar = calls.find((call) => call.key === 'PUT /api/members/2/avatar')
    expect(avatar?.body).toBeInstanceOf(Blob)
    expect(avatar?.headers['Content-Type']).toBe('image/webp')
    expect(avatar?.headers['X-CSRF-Token']).toBe('csrf-123')
  })

  it('verlangt einen Namen', async () => {
    const user = userEvent.setup()
    const calls = mockApi({
      ...unlocked,
      'GET /api/auth/me': me(),
      'GET /api/members': Response.json([]),
    })
    renderApp('/parents')

    await user.click(await screen.findByRole('button', { name: 'Person hinzufügen' }))
    await user.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(screen.getByText('Bitte ausfüllen')).toBeVisible()
    expect(calls.some((call) => call.key === 'POST /api/members')).toBe(false)
  })

  it('meldet eine bereits vergebene Farbe', async () => {
    const user = userEvent.setup()
    mockApi({
      ...unlocked,
      'GET /api/auth/me': me(),
      'GET /api/members': Response.json([]),
      'POST /api/members': Response.json({ code: 'member.color_taken' }, { status: 409 }),
    })
    renderApp('/parents')

    await user.click(await screen.findByRole('button', { name: 'Person hinzufügen' }))
    await user.type(screen.getByLabelText('Name'), 'Tom')
    await user.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Diese Farbe ist schon vergeben')
  })

  it('löscht eine Person erst nach Bestätigung', async () => {
    const user = userEvent.setup()
    const calls = mockApi({
      ...unlocked,
      'GET /api/auth/me': me(),
      'GET /api/members': Response.json([makeMember()]),
      'DELETE /api/members/1': new Response(null, { status: 204 }),
    })
    renderApp('/parents')

    await user.click(await screen.findByRole('button', { name: 'Lena bearbeiten' }))
    await user.click(screen.getByRole('button', { name: 'Person löschen' }))
    expect(calls.some((call) => call.key === 'DELETE /api/members/1')).toBe(false)
    const confirm = screen.getByText(/Lena wirklich löschen/).parentElement!
    await user.click(within(confirm).getByRole('button', { name: 'Person löschen' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Lena ist gelöscht.')
    expect(calls.some((call) => call.key === 'DELETE /api/members/1')).toBe(true)
  })

  it('funktioniert auch auf Englisch', async () => {
    const english = makeMe({ parent_unlocked: true })
    english.family.default_language = 'en'
    mockApi({
      ...unlocked,
      'GET /api/auth/me': Response.json(english),
      'GET /api/members': Response.json([makeMember()]),
    })
    renderApp('/parents')

    expect(await screen.findByRole('heading', { name: 'Family members' })).toBeVisible()
    expect(await screen.findByRole('button', { name: 'Edit Lena' })).toHaveTextContent('Child')
  })
})
