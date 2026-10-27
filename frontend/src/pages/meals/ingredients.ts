import { normalize } from '../../icons/catalog'

/**
 * Aus einer Zutat wird ein Artikel für die Einkaufsliste: „ca. 600 g Pellkartoffeln“ →
 * Pellkartoffeln mit dem Hinweis „ca. 600 g“. Erkannt werden eine Menge am Anfang (auch „2-3“,
 * „1,5“, „½“) und danach eine übliche Einheit; ohne Menge bleibt die Zeile der Name.
 */
export interface Ingredient {
  name: string
  /** Menge als Hinweis auf der Einkaufsliste; leer, wenn keine erkannt wurde. */
  note: string
}

/** So lang darf ein Hinweis auf der Einkaufsliste sein (wie im Backend). */
export const NOTE_MAX = 60
/** So lang darf ein Artikelname sein (wie im Backend). */
const NAME_MAX = 100

export const APPROX = String.raw`(?:ca\.?|circa|etwa|approx\.?|about|je)\s*`
export const AMOUNT = String.raw`(?:\d+(?:[.,/]\d+)?|[½¼¾⅓⅔])(?:\s*(?:-|–|bis|to)\s*(?:\d+(?:[.,/]\d+)?|[½¼¾⅓⅔]))?`
const UNITS = [
  'kg',
  'g',
  'mg',
  'l',
  'ml',
  'cl',
  'dl',
  'EL',
  'TL',
  'Msp\\.?',
  'Prisen?',
  'Packung(?:en)?',
  'Pck\\.?',
  'Päckchen',
  'Dosen?',
  'Becher',
  'Bund',
  'Stücke?',
  'Stk\\.?',
  'Scheiben?',
  'Tassen?',
  'Handvoll',
  'Gläser',
  'Glas',
  'Zehen?',
  'Würfel',
  'Beutel',
  'Flaschen?',
  'Köpfe?',
  'Kopf',
  'Stangen?',
  'Zweige?',
  'Blätter',
  'Blatt',
  'tbsp',
  'tsp',
  'cups?',
  'cans?',
  'packs?',
  'packets?',
  'pinch(?:es)?',
  'cartons?',
  'handfuls?',
  'slices?',
  'cloves?',
  'bunch(?:es)?',
  'jars?',
  'pieces?',
  'oz',
  'lbs?',
].join('|')
const QUANTITY = new RegExp(
  String.raw`^(?:${APPROX})?${AMOUNT}(?:\s*(?:${UNITS})(?![\p{L}]))?\.?\s+`,
  'iu',
)

const UNIT_ONLY = new RegExp(String.raw`^(?:${UNITS})\.?$`, 'iu')

/** Ein Zusatz in Klammern am Ende („Paprika (rot)“) gehört nicht in den Namen des Artikels. */
const TRAILING_NOTE = /\s*\([^()]*\)$/

export function parseIngredient(line: string): Ingredient {
  const full = line.replace(/\s+/g, ' ').trim()
  const text = full.replace(TRAILING_NOTE, '') || full
  const match = QUANTITY.exec(text)
  if (!match) return { name: text.slice(0, NAME_MAX), note: '' }
  const name = text.slice(match[0].length).trim()
  // „500 g“ allein: Was nach der Zahl kommt, ist nur eine Einheit, kein Artikel.
  if (!name || UNIT_ONLY.test(name)) return { name: text.slice(0, NAME_MAX), note: '' }
  return { name: name.slice(0, NAME_MAX), note: match[0].trim().slice(0, NOTE_MAX) }
}

/** Was fast jeder im Haus hat; steht anfangs nicht angehakt da. */
const PANTRY = [
  'salz',
  'pfeffer',
  'salz und pfeffer',
  'salz, pfeffer',
  'öl',
  'olivenöl',
  'wasser',
  'zucker',
  'salt',
  'pepper',
  'salt and pepper',
  'salt, pepper',
  'oil',
  'olive oil',
  'water',
  'sugar',
]

export const isPantry = (name: string) => PANTRY.includes(normalize(name))

/**
 * Zutaten mehrerer Rezepte zusammengefasst: gleiche Namen (Schreibweise egal) werden ein Artikel,
 * ihre Mengen stehen mit „+“ im Hinweis („1 + 2“).
 */
export function combineIngredients(lines: readonly string[]): Ingredient[] {
  const byName = new Map<string, Ingredient>()
  for (const line of lines) {
    const ingredient = parseIngredient(line)
    if (!ingredient.name) continue
    const key = normalize(ingredient.name)
    const known = byName.get(key)
    if (!known) {
      byName.set(key, ingredient)
      continue
    }
    const note = [known.note, ingredient.note].filter(Boolean).join(' + ')
    known.note = note.slice(0, NOTE_MAX)
  }
  return [...byName.values()]
}
