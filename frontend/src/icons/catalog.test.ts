import { describe, expect, it } from 'vitest'

import i18n, { SUPPORTED_LANGUAGES, resources } from '../i18n'
import {
  CATALOG_ICONS,
  ICON_CATEGORIES,
  iconBody,
  iconId,
  iconLabel,
  searchIcons,
  suggestIcon,
} from './catalog'

describe('Icon-Katalog', () => {
  it('bündelt jedes Katalog-Icon lokal', () => {
    for (const name of CATALOG_ICONS) expect(iconBody(iconId(name)), name).toMatch(/<path/)
  })

  it('führt jedes Icon nur einmal', () => {
    const all = ICON_CATEGORIES.flatMap((category) => category.icons)
    expect(all.length).toBe(new Set(all).size)
  })

  for (const language of SUPPORTED_LANGUAGES) {
    it(`${language}: hat Suchbegriffe für genau die Katalog-Icons`, () => {
      expect(Object.keys(resources[language].icons).sort()).toEqual([...CATALOG_ICONS].sort())
    })

    it(`${language}: benennt jedes Icon eindeutig`, () => {
      const labels = CATALOG_ICONS.map((name) => iconLabel(i18n.getFixedT(language), name))
      const duplicates = labels.filter((label, index) => labels.indexOf(label) !== index)
      expect(duplicates).toEqual([])
    })

    it(`${language}: hat eine Bezeichnung für jede Kategorie`, () => {
      for (const { id } of ICON_CATEGORIES) {
        expect(i18n.exists(`icon_categories.${id}`, { lng: language }), id).toBe(true)
      }
    })
  }

  it('findet dasselbe Icon auf Deutsch und Englisch, unabhängig von der Sprache', async () => {
    for (const language of SUPPORTED_LANGUAGES) {
      await i18n.changeLanguage(language)
      expect(searchIcons('Zahn')).toContain('toothbrush')
      expect(searchIcons('tooth')).toContain('toothbrush')
    }
  })

  it('ignoriert Groß-/Kleinschreibung und Umlaute', () => {
    expect(searchIcons('ZAHNE')).toContain('toothbrush')
    expect(searchIcons('Fussball')).toContain('soccer-ball')
  })

  it('verlangt jedes Wort der Suche', () => {
    expect(searchIcons('Hund füttern')).toEqual(expect.arrayContaining(['dog', 'bone']))
    expect(searchIcons('Hund füttern')).not.toContain('cat')
    expect(searchIcons('xyz')).toEqual([])
    expect(searchIcons('   ')).toEqual([])
  })

  it('schlägt ein Icon zum Titel vor', () => {
    expect(suggestIcon('Zähne putzen')).toBe('fluent-emoji-flat:toothbrush')
    expect(suggestIcon('Zimmer aufräumen')).toBe('fluent-emoji-flat:teddy-bear')
    expect(suggestIcon('Feed the cat')).toBe('fluent-emoji-flat:cat')
    expect(suggestIcon('Qwertz')).toBeNull()
  })

  it('benennt Icons in der aktuellen Sprache', async () => {
    await i18n.changeLanguage('en')
    expect(iconLabel(i18n.t, 'toothbrush')).toBe('Brush teeth')
    await i18n.changeLanguage('de')
    expect(iconLabel(i18n.t, 'toothbrush')).toBe('Zähne putzen')
  })
})
