import { ICON_CATEGORIES, iconId, normalize, searchIcons } from './icons/catalog'

/**
 * Gemeinsame Logik für eingetippte Namen mit automatischem Symbol (Gerichte, Einkauf): bekannte
 * Einträge der Familie, dann Vorlagen, sonst ein passendes Symbol aus bestimmten Kategorien.
 */

// Füllwörter tragen nichts zum Symbol bei („mit“ steckt sonst etwa in „Mittagessen“).
const FILLER_WORDS = new Set([
  'mit',
  'und',
  'oder',
  'von',
  'vom',
  'aus',
  'dem',
  'den',
  'der',
  'die',
  'das',
  'with',
  'and',
  'the',
  'from',
])

export interface Named {
  name: string
  icon: string
}

/** Symbole der angegebenen Icon-Kategorien, als Menge der Katalognamen. */
export function iconsOf(categoryIds: readonly string[]): ReadonlySet<string> {
  return new Set(
    ICON_CATEGORIES.filter((category) => categoryIds.includes(category.id)).flatMap(
      (category) => category.icons,
    ),
  )
}

/**
 * Symbol zu einem eingetippten Namen: ein bekannter Eintrag oder eine Vorlage bringt seins mit,
 * sonst das erste passende Symbol aus `allowed`, erst zum ganzen Namen, dann zu einzelnen Wörtern.
 * Längere Wörter zuerst: Das Ding selbst ist meist länger als seine Beschreibung („Rote Zwiebeln“,
 * „Red grapes“), und kurze Wörter stecken leicht in fremden Begriffen („rote“ in „Schildkröte“).
 */
export function iconForTyped(
  name: string,
  known: readonly Named[],
  allowed: ReadonlySet<string>,
  fallback: string,
): string {
  const key = normalize(name.trim())
  if (!key) return fallback
  const match = known.find((entry) => normalize(entry.name) === key)
  if (match) return match.icon
  const words = name
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !FILLER_WORDS.has(normalize(word)))
    .sort((a, b) => b.length - a.length)
  for (const query of [name, ...words]) {
    const icon = searchIcons(query).find((candidate) => allowed.has(candidate))
    if (icon) return iconId(icon)
  }
  return fallback
}

/**
 * Vorschläge in der gegebenen Reihenfolge ohne doppelte Namen (Schreibweise egal); mit Suchbegriff
 * nur, was jedes eingetippte Wort enthält.
 */
export function filterSuggestions<T extends { name: string }>(
  query: string,
  candidates: Iterable<T>,
): T[] {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  const seen = new Set<string>()
  const result: T[] = []
  for (const candidate of candidates) {
    const key = normalize(candidate.name)
    if (seen.has(key) || !words.every((word) => key.includes(word))) continue
    seen.add(key)
    result.push(candidate)
  }
  return result
}
