import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ShoppingItem, ShoppingList } from '../api/shopping'
import i18n from '../i18n'
import { makeMe, mockApi, renderApp, setupDone } from '../test/utils'

beforeEach(async () => {
  await i18n.changeLanguage('de')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const MILK = 'fluent-emoji-flat:glass-of-milk'

const LIST: ShoppingList = {
  items: [
    { id: 1, name: 'Milch', icon: MILK, note: '2 ×', checked: false },
    { id: 2, name: 'Brot', icon: 'fluent-emoji-flat:bread', note: null, checked: false },
    { id: 3, name: 'Eier', icon: 'fluent-emoji-flat:egg', note: null, checked: true },
  ],
}

const ITEMS: ShoppingItem[] = [
  { id: 1, name: 'Milch', icon: MILK, times_added: 5, on_list: true },
  {
    id: 4,
    name: 'Hafermilch',
    icon: 'fluent-emoji-flat:beverage-box',
    times_added: 1,
    on_list: false,
  },
]

function mockShopping(list: ShoppingList = LIST, extra: Parameters<typeof mockApi>[0] = {}) {
  return mockApi({
    'GET /api/setup/status': setupDone,
    'GET /api/auth/me': Response.json(makeMe()),
    'GET /api/shopping/list': Response.json(list),
    'GET /api/shopping/items': Response.json(ITEMS),
    'PUT /api/shopping/list/1/checked': (body) =>
      Response.json({ ...LIST.items[0], ...(body as object) }),
    'PUT /api/shopping/list/3/checked': (body) =>
      Response.json({ ...LIST.items[2], ...(body as object) }),
    'DELETE /api/shopping/list/1': new Response(null, { status: 204 }),
    'DELETE /api/shopping/list/checked': new Response(null, { status: 204 }),
    'POST /api/shopping/list': (body) =>
      Response.json({ id: 9, note: null, checked: false, ...(body as object) }),
    ...extra,
  })
}

const bodyOf = (calls: ReturnType<typeof mockApi>, key: string) =>
  calls.find((call) => call.key === key)?.body

describe('Einkaufsliste', () => {
  it('ist über die Navigationsleiste erreichbar', async () => {
    const user = userEvent.setup()
    mockShopping()
    renderApp('/meals')

    await user.click(await screen.findByRole('link', { name: 'Einkauf' }))

    expect(await screen.findByRole('heading', { name: 'Einkaufsliste', level: 1 })).toBeVisible()
  })

  it('zeigt offene Artikel mit Hinweis, darunter die abgehakten', async () => {
    mockShopping()
    renderApp('/shopping')

    const milk = await screen.findByRole('button', { name: /^Milch ?2 ×$/ })
    expect(milk).toHaveAttribute('aria-pressed', 'false')
    expect(within(milk).getByText('2 ×')).toBeVisible()
    const checked = within(screen.getByRole('region', { name: 'Abgehakt' }))
    expect(checked.getByRole('button', { name: 'Eier' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('hakt per Tipp ab und nimmt es mit einem weiteren Tipp zurück', async () => {
    const user = userEvent.setup()
    const calls = mockShopping()
    renderApp('/shopping')

    await user.click(await screen.findByRole('button', { name: /^Milch ?2 ×$/ }))
    expect(bodyOf(calls, 'PUT /api/shopping/list/1/checked')).toEqual({ checked: true })

    await user.click(screen.getByRole('button', { name: 'Eier' }))
    expect(bodyOf(calls, 'PUT /api/shopping/list/3/checked')).toEqual({ checked: false })
  })

  it('nimmt einen Artikel von der Liste und räumt Abgehakte weg', async () => {
    const user = userEvent.setup()
    const calls = mockShopping()
    renderApp('/shopping')

    await user.click(await screen.findByRole('button', { name: 'Milch von der Liste nehmen' }))
    await user.click(screen.getByRole('button', { name: 'Abgehakte entfernen' }))

    const keys = calls.map((call) => call.key)
    expect(keys).toContain('DELETE /api/shopping/list/1')
    expect(keys).toContain('DELETE /api/shopping/list/checked')
  })

  it('zeigt eine leere Liste freundlich an', async () => {
    mockShopping({ items: [] })
    renderApp('/shopping')

    expect(await screen.findByRole('button', { name: /Alles da!/ })).toBeVisible()
    expect(screen.queryByRole('region', { name: 'Abgehakt' })).toBeNull()
  })
})

describe('Eintragen', () => {
  async function openAdder(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('button', { name: 'Eintragen' }))
    return within(await screen.findByRole('dialog', { name: 'Was fehlt?' }))
  }

  it('trägt einen eingetippten Artikel mit Menge ein, Symbol automatisch', async () => {
    const user = userEvent.setup()
    const calls = mockShopping()
    renderApp('/shopping')
    const dialog = await openAdder(user)

    await user.type(dialog.getByRole('textbox', { name: 'Artikel' }), 'Rote Zwiebeln')
    await user.type(dialog.getByRole('textbox', { name: 'Menge oder Hinweis' }), '1 Netz')
    await user.click(dialog.getByRole('button', { name: 'Hinzufügen' }))

    expect(await dialog.findByText('„Rote Zwiebeln“ steht auf der Liste.')).toBeVisible()
    expect(bodyOf(calls, 'POST /api/shopping/list')).toEqual({
      name: 'Rote Zwiebeln',
      icon: 'fluent-emoji-flat:onion',
      note: '1 Netz',
    })
    // Bereit für den nächsten Artikel.
    expect(dialog.getByRole('textbox', { name: 'Artikel' })).toHaveValue('')
  })

  it('zeigt, was schon auf der Liste steht; nochmal antippen nimmt es weg', async () => {
    const user = userEvent.setup()
    const calls = mockShopping()
    renderApp('/shopping')
    const dialog = await openAdder(user)

    const milk = dialog.getByRole('button', { name: 'Milch' })
    expect(milk).toHaveAttribute('aria-pressed', 'true')
    expect(dialog.getByRole('button', { name: 'Hafermilch' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )

    await user.click(milk)

    expect(calls.map((call) => call.key)).toContain('DELETE /api/shopping/list/1')
  })

  it('findet Vorschläge beim Tippen, eigene zuerst', async () => {
    const user = userEvent.setup()
    mockShopping()
    renderApp('/shopping')
    const dialog = await openAdder(user)

    await user.type(dialog.getByRole('textbox', { name: 'Artikel' }), 'milch')

    const names = within(dialog.getByRole('list', { name: 'Vorschläge' }))
      .getAllByRole('listitem')
      .map((item) => within(item).getAllByRole('button')[0].textContent)
    expect(names).toEqual(['Milch', 'Hafermilch'])
  })

  it('benennt einen eigenen Artikel über den Stift um', async () => {
    const user = userEvent.setup()
    const calls = mockShopping(LIST, {
      'PUT /api/shopping/items/4': (body) => Response.json({ ...ITEMS[1], ...(body as object) }),
    })
    renderApp('/shopping')
    const dialog = await openAdder(user)

    await user.click(dialog.getByRole('button', { name: 'Hafermilch bearbeiten' }))
    const name = await dialog.findByRole('textbox', { name: 'Artikel' })
    await user.clear(name)
    await user.type(name, 'Haferdrink')
    await user.click(dialog.getByRole('button', { name: 'Speichern' }))

    expect(bodyOf(calls, 'PUT /api/shopping/items/4')).toEqual({
      name: 'Haferdrink',
      icon: 'fluent-emoji-flat:beverage-box',
    })
  })
})
