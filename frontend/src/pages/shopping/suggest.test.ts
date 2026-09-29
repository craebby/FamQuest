import { beforeEach, describe, expect, it } from 'vitest'

import type { ShoppingItem } from '../../api/shopping'
import i18n from '../../i18n'
import { CATALOG_ICONS } from '../../icons/catalog'
import { GROCERY_POOL } from '../../pools/groceries'
import { DEFAULT_ITEM_ICON, iconForItem, itemSuggestions } from './suggest'

const t = i18n.t.bind(i18n)

const item = (overrides: Partial<ShoppingItem> = {}): ShoppingItem => ({
  id: 1,
  name: 'Hafermilch',
  icon: 'fluent-emoji-flat:beverage-box',
  times_added: 4,
  on_list: false,
  ...overrides,
})

beforeEach(async () => {
  await i18n.changeLanguage('de')
})

describe('Standardartikel', () => {
  it('haben Symbole aus dem Katalog und Namen in jeder Sprache', () => {
    for (const template of GROCERY_POOL) {
      expect(CATALOG_ICONS, template.id).toContain(template.icon)
      for (const lng of ['de', 'en']) {
        expect(i18n.exists(`groceries.${template.id}`, { ns: 'pool', lng }), template.id).toBe(true)
      }
    }
  })
})

describe('Symbol zum Namen', () => {
  it('nimmt das Symbol eines bekannten Artikels, unabhängig von der Schreibweise', () => {
    expect(iconForItem(t, 'hafermilch', [item()])).toBe('fluent-emoji-flat:beverage-box')
  })

  it('nimmt das Symbol eines Standardartikels', () => {
    expect(iconForItem(t, 'Milch', [])).toBe('fluent-emoji-flat:glass-of-milk')
    expect(iconForItem(t, 'Klopapier', [])).toBe('fluent-emoji-flat:roll-of-paper')
    expect(iconForItem(t, 'Windeln', [])).toBe('fluent-emoji-flat:baby')
  })

  it('findet sonst ein passendes Symbol über einzelne Wörter, auch auf Englisch', async () => {
    expect(iconForItem(t, 'Rote Zwiebeln', [])).toBe('fluent-emoji-flat:onion')
    expect(iconForItem(t, 'Milch laktosefrei', [])).toBe('fluent-emoji-flat:glass-of-milk')
    await i18n.changeLanguage('en')
    expect(iconForItem(t, 'Red grapes', [])).toBe('fluent-emoji-flat:grapes')
  })

  it('nimmt ohne Treffer die Einkaufstüten, auch keine Aufgaben-Symbole', () => {
    expect(iconForItem(t, 'Geschenkpapier', [])).toBe(DEFAULT_ITEM_ICON)
    // „Bett“ passt zum Bett, das kauft man aber nicht im Laden.
    expect(iconForItem(t, 'Bett', [])).toBe(DEFAULT_ITEM_ICON)
    expect(iconForItem(t, ' ', [])).toBe(DEFAULT_ITEM_ICON)
  })
})

describe('Vorschläge', () => {
  it('zeigt erst die eigenen Artikel, dann alle Standardartikel ohne Doppelte', () => {
    const own = [item(), item({ id: 2, name: 'milch', on_list: true })]
    const suggestions = itemSuggestions(t, '', own)

    expect(suggestions.slice(0, 2)).toEqual([
      { name: 'Hafermilch', icon: 'fluent-emoji-flat:beverage-box', item_id: 1, on_list: false },
      { name: 'milch', icon: 'fluent-emoji-flat:beverage-box', item_id: 2, on_list: true },
    ])
    expect(suggestions.filter((s) => s.name.toLowerCase() === 'milch')).toHaveLength(1)
    expect(suggestions).toHaveLength(2 + GROCERY_POOL.length - 1)
  })

  it('filtert nach jedem eingetippten Wort, ohne Umlaute zu verlangen', () => {
    expect(itemSuggestions(t, 'milch', [item()]).map((s) => s.name)).toEqual([
      'Hafermilch',
      'Milch',
    ])
    expect(itemSuggestions(t, 'apfel', []).map((s) => s.name)).toEqual(['Äpfel'])
  })
})
