import type { TFunction } from 'i18next'

import { iconId } from '../icons/catalog'

export interface EventSymbolTemplate {
  /** Schlüssel für die Begriffe in locales/<sprache>/pool.json (`event_symbols.<id>`). */
  id: string
  /** Name im Icon-Katalog (src/icons/categories.json). */
  icon: string
}

/**
 * Häufige Termine von Kindern als Vorschläge für „Symbole für Termine“. Übernommen werden die
 * Begriffe in der aktuellen Sprache; danach lassen sie sich frei ändern.
 */
export const EVENT_SYMBOL_POOL: readonly EventSymbolTemplate[] = [
  { id: 'gymnastics', icon: 'person-cartwheeling' },
  { id: 'judo', icon: 'martial-arts-uniform' },
  { id: 'riding', icon: 'horse-racing' },
  { id: 'swimming', icon: 'person-swimming' },
  { id: 'football', icon: 'soccer-ball' },
  { id: 'tennis', icon: 'tennis' },
  { id: 'dance', icon: 'ballet-shoes' },
  { id: 'climbing', icon: 'person-climbing' },
  { id: 'music', icon: 'musical-note' },
  { id: 'crafts', icon: 'artist-palette' },
  { id: 'playdate', icon: 'people-hugging' },
  { id: 'birthday', icon: 'birthday-cake' },
  { id: 'party', icon: 'party-popper' },
  { id: 'grandparents', icon: 'older-person' },
  { id: 'daycare', icon: 'teddy-bear' },
  { id: 'school', icon: 'school' },
  { id: 'library', icon: 'books' },
  { id: 'doctor', icon: 'stethoscope' },
  { id: 'dentist', icon: 'tooth' },
  { id: 'vaccination', icon: 'syringe' },
  { id: 'haircut', icon: 'person-getting-haircut' },
  { id: 'cinema', icon: 'popcorn' },
  { id: 'trip', icon: 'bus' },
]

/** Begriffe eines Vorschlags; der erste ist sein Name. */
export const eventSymbolTemplateTerms = (t: TFunction, template: EventSymbolTemplate) =>
  splitTerms(t(`event_symbols.${template.id}`, { ns: 'pool' }))

export const eventSymbolTemplateIcon = (template: EventSymbolTemplate) => iconId(template.icon)

/** „Judo, Karate ,, Kampfsport“ → ["Judo", "Karate", "Kampfsport"]. */
export function splitTerms(text: string): string[] {
  return text
    .split(/[,;\n]/)
    .map((term) => term.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}
