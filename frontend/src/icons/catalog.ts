import type { TFunction } from 'i18next'
import taskIcons from 'virtual:task-icons'

import i18n, { SUPPORTED_LANGUAGES } from '../i18n'
import categories from './categories.json'

/**
 * Kuratierter Icon-Katalog für Aufgaben (Fluent Emoji, beim Build eingebettet).
 * Kategorien und Reihenfolge stehen in categories.json, Suchbegriffe je Sprache in
 * locales/<sprache>/icons.json (erster Begriff = Bezeichnung des Icons).
 */
export const ICON_SET = 'fluent-emoji-flat'
export const ICON_CATEGORIES: readonly { id: string; icons: readonly string[] }[] = categories
export const CATALOG_ICONS: readonly string[] = [...new Set(categories.flatMap((c) => c.icons))]
export const DEFAULT_TASK_ICON = `${ICON_SET}:check-mark-button`

/** `fluent-emoji-flat:toothbrush` → `toothbrush`; unbekannte Sets → null. */
export function iconName(icon: string): string | null {
  const [set, name] = icon.split(':')
  return set === ICON_SET && name ? name : null
}

export const iconId = (name: string) => `${ICON_SET}:${name}`

export function iconBody(icon: string): string | undefined {
  const name = iconName(icon)
  return name ? taskIcons.icons[name] : undefined
}

export const ICON_VIEWBOX = `0 0 ${taskIcons.width} ${taskIcons.height}`

/** Bezeichnung eines Icons in der aktuellen Sprache (für Screenreader und Tooltips). */
export function iconLabel(t: TFunction, name: string): string {
  const terms = t(name, { ns: 'icons', defaultValue: '' })
  return terms.split(',')[0]?.trim() || name
}

/** Klein, ohne Akzente/Umlautpunkte: „Zähne“ findet man auch mit „zahne“. */
export function normalize(text: string): string {
  return text.toLocaleLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/ß/g, 'ss')
}

let searchIndex: Map<string, string> | null = null

/** Suchbegriffe aller Sprachen, damit „Zahn“ und „tooth“ immer dasselbe Icon finden. */
function getSearchIndex(): Map<string, string> {
  if (!searchIndex) {
    searchIndex = new Map(
      CATALOG_ICONS.map((name) => {
        const terms = SUPPORTED_LANGUAGES.map((language) =>
          i18n.t(name, { ns: 'icons', lng: language, defaultValue: '' }),
        )
        return [name, normalize(`${name.replace(/-/g, ' ')} ${terms.join(' ')}`)]
      }),
    )
  }
  return searchIndex
}

/** Icons, deren Suchbegriffe jedes Wort der Anfrage enthalten. */
export function searchIcons(query: string): string[] {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  return [...getSearchIndex()]
    .filter(([, terms]) => words.every((word) => terms.includes(word)))
    .map(([name]) => name)
}

/** Passendes Icon zum Titel, z. B. „Zähne putzen“ → Zahnbürste. */
export function suggestIcon(title: string): string | null {
  const exact = searchIcons(title)[0]
  if (exact) return iconId(exact)
  const words = title.split(/\s+/).filter((word) => word.length >= 3)
  for (const word of words) {
    const match = searchIcons(word)[0]
    if (match) return iconId(match)
  }
  return null
}
