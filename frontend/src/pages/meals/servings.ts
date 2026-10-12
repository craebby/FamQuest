import { AMOUNT, APPROX } from './ingredients'

/**
 * Portionen eines Rezepts: erkennen beim Einfügen („für 4 Personen“, „Portionen: 4“, „Serves 4“)
 * und die Mengen der Zutaten umrechnen („ca. 600 g Pellkartoffeln“ für 4 → „ca. 900 g …“ für 6).
 * Umgerechnet wird nur eine Menge am Anfang der Zeile, wie beim Einkaufszettel; Zutaten ohne
 * Menge („Salz und Pfeffer“) bleiben, wie sie sind.
 */

/** So viele Portionen kann ein Rezept haben (wie im Backend). */
export const MAX_SERVINGS = 50

const COUNT = String.raw`(\d{1,2})(?:\s*(?:-|–|bis|to)\s*\d{1,2})?`
const WORD = String.raw`(?:portionen|portion|personen|person|pers\.?|port\.?|servings?|portions?|people|persons)`
// „für 4 Personen“, „4 Portionen“, „Zutaten für 4 Personen“, „Zutaten (für 4 Personen)“
const COUNT_FIRST = new RegExp(
  String.raw`^(?:zutaten|ingredients)?\s*\(?\s*(?:für|for)?\s*${COUNT}\s*${WORD}\s*\)?\s*:?$`,
  'iu',
)
// „Portionen: 4“, „Serves 4“, „Makes 4 servings“
const WORD_FIRST = new RegExp(
  String.raw`^(?:portionen|personen|serves|servings|yield|makes)\s*:?\s*${COUNT}(?:\s*${WORD})?$`,
  'iu',
)

/** Portionen aus einer Zeile wie „für 4 Personen“; sonst null. Bei „4-6“ zählt die erste Zahl. */
export function servingsIn(line: string): number | null {
  const text = line.replace(/\s+/g, ' ').trim()
  const match = COUNT_FIRST.exec(text) ?? WORD_FIRST.exec(text)
  if (!match) return null
  const count = Number(match[1])
  return count >= 1 && count <= MAX_SERVINGS ? count : null
}

/** Eingabe aus einem Zahlenfeld: leer oder keine Zahl heißt keine Angabe; sonst 1 bis 50. */
export const parseServings = (text: string) => {
  const count = Math.trunc(Number(text))
  return text.trim() && Number.isFinite(count) && count >= 1 ? Math.min(count, MAX_SERVINGS) : null
}

const FRACTIONS: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 }
const QUARTERS = ['', '¼', '½', '¾']

const LEADING = new RegExp(String.raw`^((?:${APPROX})?)(${AMOUNT})`, 'iu')
const NUMBER = /\d+(?:[.,/]\d+)?|[½¼¾⅓⅔]/g

function parseNumber(text: string): number {
  if (text in FRACTIONS) return FRACTIONS[text]
  if (text.includes('/')) {
    const [top, bottom] = text.split('/').map(Number)
    return bottom ? top / bottom : top
  }
  return Number(text.replace(',', '.'))
}

/**
 * Gut lesbar gerundet: unter 1 in Vierteln (¼, ½, ¾), bis 10 auf halbe, bis 50 auf ganze, darüber
 * auf fünf (187,5 g → 190 g). Nie 0, damit keine Zutat verschwindet.
 */
export function formatAmount(value: number, decimal: string): string {
  if (value < 1) return QUARTERS[Math.min(3, Math.max(1, Math.round(value * 4)))]
  const rounded =
    value < 10
      ? Math.round(value * 2) / 2
      : value < 50
        ? Math.round(value)
        : Math.round(value / 5) * 5
  return String(rounded).replace('.', decimal)
}

/** Rechnet die Menge am Anfang einer Zutat um; `factor` 1 lässt die Zeile unverändert. */
export function scaleIngredient(line: string, factor: number, decimal: string): string {
  if (factor === 1) return line
  const match = LEADING.exec(line)
  if (!match) return line
  const [whole, approx, amount] = match
  const scaled = amount.replace(NUMBER, (number) =>
    formatAmount(parseNumber(number) * factor, decimal),
  )
  return approx + scaled + line.slice(whole.length)
}

/** Dezimaltrennzeichen der Sprache: „1,5“ auf Deutsch, „1.5“ auf Englisch. */
export const decimalOf = (language: string) => (language.startsWith('de') ? ',' : '.')
