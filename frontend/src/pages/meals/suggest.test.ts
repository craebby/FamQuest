import { beforeEach, describe, expect, it } from 'vitest'

import type { Dish } from '../../api/meals'
import i18n from '../../i18n'
import { DISH_POOL } from '../../pools/dishes'
import { CATALOG_ICONS } from '../../icons/catalog'
import { DEFAULT_DISH_ICON, dishSuggestions, iconForName } from './suggest'

const t = i18n.t.bind(i18n)

const dish = (overrides: Partial<Dish> = {}): Dish => ({
  id: 1,
  name: 'Omas Linsensuppe',
  icon: 'fluent-emoji-flat:pot-of-food',
  last_planned: '2026-10-01',
  times_planned: 3,
  ...overrides,
})

beforeEach(async () => {
  await i18n.changeLanguage('de')
})

describe('Standardgerichte', () => {
  it('haben Symbole aus dem Katalog und Namen in jeder Sprache', () => {
    for (const template of DISH_POOL) {
      expect(CATALOG_ICONS, template.id).toContain(template.icon)
      for (const lng of ['de', 'en']) {
        expect(i18n.exists(`dishes.${template.id}`, { ns: 'pool', lng }), template.id).toBe(true)
      }
    }
  })
})

describe('Symbol zum Namen', () => {
  it('nimmt das Symbol eines bekannten Gerichts, unabhängig von der Schreibweise', () => {
    expect(iconForName(t, 'omas linsensuppe', [dish()])).toBe('fluent-emoji-flat:pot-of-food')
  })

  it('nimmt das Symbol eines Standardgerichts', () => {
    expect(iconForName(t, 'Nudeln mit Tomatensoße', [])).toBe('fluent-emoji-flat:spaghetti')
    expect(iconForName(t, 'Käsespätzle', [])).toBe('fluent-emoji-flat:cheese-wedge')
    expect(iconForName(t, 'Backcamembert', [])).toBe('fluent-emoji-flat:cheese-wedge')
  })

  it('findet sonst ein passendes Essens-Symbol über einzelne Wörter', () => {
    expect(iconForName(t, 'Schnitzel mit Reis', [])).toBe('fluent-emoji-flat:cut-of-meat')
    expect(iconForName(t, 'Burger vom Grill', [])).toBe('fluent-emoji-flat:hamburger')
    expect(iconForName(t, 'Ofencamembert mit Preiselbeeren', [])).toBe(
      'fluent-emoji-flat:cheese-wedge',
    )
  })

  it('findet auch englische Namen', async () => {
    await i18n.changeLanguage('en')
    expect(iconForName(t, 'Chicken curry', [])).toBe('fluent-emoji-flat:poultry-leg')
    expect(iconForName(t, 'Pasta with tomato sauce', [])).toBe('fluent-emoji-flat:spaghetti')
  })

  it('nimmt ohne Treffer den Teller, auch keine Aufgaben-Symbole', () => {
    expect(iconForName(t, 'Überraschung', [])).toBe(DEFAULT_DISH_ICON)
    // „Zähne“ passt zur Zahnbürste, die ist aber kein Essen.
    expect(iconForName(t, 'Zähne', [])).toBe(DEFAULT_DISH_ICON)
    expect(iconForName(t, '  ', [])).toBe(DEFAULT_DISH_ICON)
  })
})

describe('Vorschläge', () => {
  it('zeigt ohne Suche erst die eigenen Gerichte, dann alle Standardgerichte ohne Doppelte', () => {
    const own = [dish(), dish({ id: 2, name: 'pizza', icon: 'fluent-emoji-flat:hamburger' })]
    const suggestions = dishSuggestions(t, '', own)

    expect(suggestions.slice(0, 2).map((s) => s.name)).toEqual(['Omas Linsensuppe', 'pizza'])
    expect(suggestions.filter((s) => s.name.toLowerCase() === 'pizza')).toHaveLength(1)
    expect(suggestions).toHaveLength(2 + DISH_POOL.length - 1)
  })

  it('filtert nach jedem eingetippten Wort, ohne Umlaute zu verlangen', () => {
    const names = dishSuggestions(t, 'nudel soss', [dish()]).map((s) => s.name)
    expect(names).toEqual(['Nudeln mit Tomatensoße'])
    expect(dishSuggestions(t, 'suppe', [dish()]).map((s) => s.name)).toEqual([
      'Omas Linsensuppe',
      'Nudelsuppe',
      'Tomatensuppe',
    ])
  })
})
