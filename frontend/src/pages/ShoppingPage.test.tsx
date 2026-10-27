import { onlineManager } from '@tanstack/react-query'
import { screen, waitFor, within } from '@testing-library/react'
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
  onlineManager.setOnline(true)
})

const MILK = 'fluent-emoji-flat:glass-of-milk'

const LIST: ShoppingList = {
  items: [
    { id: 1, name: 'Milch', icon: MILK, note: '2 ×', checked: false, area: null, position: null },
    {
      id: 2,
      name: 'Brot',
      icon: 'fluent-emoji-flat:bread',
      note: null,
      checked: false,
      area: null,
      position: null,
    },
    {
      id: 3,
      name: 'Eier',
      icon: 'fluent-emoji-flat:egg',
      note: null,
      checked: true,
      area: null,
      position: null,
    },
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
    expect(within(milk).getByText('2 ×')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Milch abhaken' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    const checked = within(screen.getByRole('region', { name: 'Abgehakt' }))
    expect(checked.getByRole('button', { name: 'Eier abhaken' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('hakt per Tipp auf den Kreis ab und nimmt es mit einem weiteren Tipp zurück', async () => {
    const user = userEvent.setup()
    const calls = mockShopping()
    renderApp('/shopping')

    await user.click(await screen.findByRole('button', { name: 'Milch abhaken' }))
    expect(bodyOf(calls, 'PUT /api/shopping/list/1/checked')).toEqual({ checked: true })

    await user.click(screen.getByRole('button', { name: 'Eier abhaken' }))
    expect(bodyOf(calls, 'PUT /api/shopping/list/3/checked')).toEqual({ checked: false })
  })

  it('öffnet per Tipp auf den Artikel die Bearbeitung, ohne abzuhaken', async () => {
    const user = userEvent.setup()
    const calls = mockShopping(LIST, {
      'PUT /api/shopping/list/1': (body) =>
        Response.json({ ...LIST.items[0], ...(body as object), id: 4 }),
    })
    renderApp('/shopping')

    await user.click(await screen.findByRole('button', { name: /^Milch ?2 ×$/ }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Milch bearbeiten' }))
    const name = dialog.getByRole('textbox', { name: 'Artikel' })
    await user.clear(name)
    await user.type(name, 'Hafermilch')
    await user.clear(dialog.getByRole('textbox', { name: 'Menge oder Hinweis' }))
    await user.click(dialog.getByRole('button', { name: 'Speichern' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() =>
      expect(bodyOf(calls, 'PUT /api/shopping/list/1')).toEqual({
        name: 'Hafermilch',
        icon: 'fluent-emoji-flat:beverage-box',
        note: '',
      }),
    )
    expect(calls.map((call) => call.key)).not.toContain('PUT /api/shopping/list/1/checked')
  })

  it('nimmt einen Artikel aus der Bearbeitung von der Liste', async () => {
    const user = userEvent.setup()
    const calls = mockShopping()
    renderApp('/shopping')

    await user.click(await screen.findByRole('button', { name: /^Milch ?2 ×$/ }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Milch bearbeiten' }))
    await user.click(dialog.getByRole('button', { name: 'Von der Liste nehmen' }))

    await waitFor(() =>
      expect(calls.map((call) => call.key)).toContain('DELETE /api/shopping/list/1'),
    )
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

describe('Nach Laden und Bereich', () => {
  const SORTED: ShoppingList = {
    items: [
      LIST.items[0],
      LIST.items[1],
      { ...LIST.items[1], id: 5, name: 'Joghurt', icon: 'fluent-emoji-flat:bowl-with-spoon' },
      { ...LIST.items[1], id: 6, name: 'Zahnpasta', icon: 'fluent-emoji-flat:toothbrush' },
    ],
  }

  it('gruppiert offene Artikel nach Laden und Bereich im Laufweg', async () => {
    mockShopping(SORTED)
    renderApp('/shopping')

    const supermarket = within(await screen.findByRole('region', { name: 'Supermarkt' }))
    const headings = supermarket.getAllByRole('heading').map((heading) => heading.textContent)
    expect(headings).toEqual(['Supermarkt', 'Brot & Backwaren', 'Kühlung'])
    const chilled = within(supermarket.getByRole('region', { name: 'Kühlung' }))
    expect(chilled.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Milch2 ×',
      'Joghurt',
    ])
    const drugstore = within(screen.getByRole('region', { name: 'Drogerie' }))
    expect(drugstore.getByRole('button', { name: 'Zahnpasta' })).toBeVisible()
  })

  it('zeigt keine Laden-Überschrift, wenn alles aus dem Supermarkt kommt', async () => {
    mockShopping()
    renderApp('/shopping')

    await screen.findByRole('button', { name: /^Milch ?2 ×$/ })
    expect(screen.queryByRole('heading', { name: 'Supermarkt' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Kühlung' })).toBeVisible()
  })

  it('ändert beim Ordnen die Reihenfolge im Bereich', async () => {
    const user = userEvent.setup()
    const calls = mockShopping(SORTED, {
      'PUT /api/shopping/order': new Response(null, { status: 204 }),
    })
    renderApp('/shopping')

    await user.click(await screen.findByRole('button', { name: 'Ordnen' }))
    expect(screen.getByRole('button', { name: 'Milch nach oben' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Joghurt nach oben' }))

    await waitFor(() => expect(bodyOf(calls, 'PUT /api/shopping/order')).toEqual({ ids: [5, 1] }))
    // Beim Ordnen wird nichts abgehakt.
    expect(screen.queryByRole('button', { name: /^Milch ?2 ×$/ })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Fertig' }))
    expect(await screen.findByRole('button', { name: /^Milch ?2 ×$/ })).toBeVisible()
  })

  it('verschiebt einen Artikel in einen anderen Laden', async () => {
    const user = userEvent.setup()
    let moved = false
    const calls = mockShopping(SORTED, {
      'GET /api/shopping/list': () =>
        Response.json({
          items: SORTED.items.map((item) =>
            moved && item.id === 1 ? { ...item, area: 'online' } : item,
          ),
        }),
      'PUT /api/shopping/items/1/area': () => {
        moved = true
        return new Response(null, { status: 204 })
      },
      'PUT /api/shopping/items/6/area': new Response(null, { status: 204 }),
    })
    renderApp('/shopping')

    await user.click(await screen.findByRole('button', { name: 'Ordnen' }))
    await user.click(screen.getByRole('button', { name: 'Milch verschieben' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Wo gibt es Milch?' }))
    expect(dialog.getByRole('button', { name: 'Kühlung' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(dialog.getByRole('button', { name: 'Online' }))

    await waitFor(() =>
      expect(bodyOf(calls, 'PUT /api/shopping/items/1/area')).toEqual({ area: 'online' }),
    )
    expect(screen.queryByRole('dialog')).toBeNull()
    const online = within(screen.getByRole('region', { name: 'Online' }))
    expect(online.getByText('Milch')).toBeVisible()

    // Zurück an den automatischen Platz: Der Artikel folgt wieder den Regeln.
    await user.click(screen.getByRole('button', { name: 'Zahnpasta verschieben' }))
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Drogerie' }),
    )
    await waitFor(() =>
      expect(bodyOf(calls, 'PUT /api/shopping/items/6/area')).toEqual({ area: null }),
    )
  })
})

describe('Im Laden ohne Netz', () => {
  it('merkt sich Abhaken und Eintragen und sendet alles der Reihe nach, sobald Netz da ist', async () => {
    const user = userEvent.setup()
    const calls = mockShopping(LIST, {
      'PUT /api/shopping/list/9/checked': (body) =>
        Response.json({ id: 9, name: 'Käse', icon: 'x', note: null, ...(body as object) }),
    })
    renderApp('/shopping')
    const milk = await screen.findByRole('button', { name: 'Milch abhaken' })
    onlineManager.setOnline(false)

    await user.click(milk)
    const checked = within(screen.getByRole('region', { name: 'Abgehakt' }))
    expect(checked.getByRole('button', { name: 'Milch abhaken' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('status')).toHaveTextContent('Offline · 1 Änderung wartet')

    // Ein neuer Artikel steht sofort auf der Liste und lässt sich gleich abhaken.
    await user.click(screen.getByRole('button', { name: 'Eintragen' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Was fehlt?' }))
    await user.type(dialog.getByRole('textbox', { name: 'Artikel' }), 'Käse')
    await user.click(dialog.getByRole('button', { name: 'Hinzufügen' }))
    await user.click(dialog.getByRole('button', { name: 'Fertig' }))
    await user.click(screen.getByRole('button', { name: 'Käse abhaken' }))
    expect(screen.getByRole('status')).toHaveTextContent('3 Änderungen warten')

    const sent = () => calls.map((call) => call.key).filter((key) => !key.startsWith('GET'))
    expect(sent()).toEqual([])

    onlineManager.setOnline(true)
    await waitFor(() =>
      expect(sent()).toEqual([
        'PUT /api/shopping/list/1/checked',
        'POST /api/shopping/list',
        'PUT /api/shopping/list/9/checked',
      ]),
    )
    expect(bodyOf(calls, 'PUT /api/shopping/list/9/checked')).toEqual({ checked: true })
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
  })
})

describe('Als App (/shop)', () => {
  it('zeigt nur die Einkaufsliste, ohne Navigationsleiste', async () => {
    mockShopping()
    renderApp('/shop')

    expect(await screen.findByRole('heading', { name: 'Einkaufsliste', level: 1 })).toBeVisible()
    expect(screen.queryByRole('navigation', { name: 'Hauptnavigation' })).toBeNull()
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
