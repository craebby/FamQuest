/**
 * Zerlegt eingefügten Text in Rezepte, nach festen Regeln und ohne externen Dienst:
 *
 * - „1. Rührei-Pfanne“ (Nummer, Punkt oder Klammer, Name) beginnt ein Rezept. Ein Zusatz in
 *   Klammern am Ende („(heute)“) fällt weg. Ohne solche Zeilen ist der ganze Text ein Rezept,
 *   dessen erste Zeile der Name ist.
 * - „Zutaten“ und „Zubereitung“ (auch englisch, mit oder ohne Doppelpunkt) teilen ein Rezept in
 *   Zutaten und Schritte, je eine Zeile. Ohne diese Überschriften ist alles Zubereitung.
 * - Aufzählungszeichen und Nummern vor Zutaten und Schritten fallen weg, leere Zeilen auch.
 *
 * Nummerierte Schritte bleiben Schritte: Ein neues Rezept beginnt nur nach einer Leerzeile, mit
 * der nächsten Nummer (nach „1.“ kommt „2.“) und ohne Satzzeichen am Ende. In Grenzfällen zeigt
 * die Vorschau, was erkannt wurde.
 */

export interface ParsedRecipe {
  name: string
  ingredients: string[]
  steps: string[]
}

/** So lang darf ein Name sein, bevor eine nummerierte Zeile eher ein Schritt ist. */
const MAX_NAME_LENGTH = 80
/** Wie im Backend: so lang dürfen Name, Zutat und Schritt sein. */
export const RECIPE_LIMITS = { name: 100, ingredient: 200, step: 1000, lines: 60, recipes: 50 }

const NUMBERED = /^\s*(\d{1,2})\s*[.)]\s+(.+)$/
const BULLET = /^\s*(?:[-*•–·]|\d{1,2}\s*[.)])\s*/
const INGREDIENTS = /^(zutaten|ingredients)\s*:?$/i
const STEPS = /^(zubereitung|anleitung|so geht'?s|preparation|instructions|method|steps)\s*:?$/i

type Section = 'steps' | 'ingredients'

const clean = (line: string) => line.replace(/\s+/g, ' ').trim()
const withoutNote = (name: string) => clean(name.replace(/\s*\([^)]*\)\s*$/, ''))

export function parseRecipes(text: string): ParsedRecipe[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const hasNumberedNames = lines.some((line) => isName(line))
  const recipes: ParsedRecipe[] = []
  let current: ParsedRecipe | null = null
  let number = 0
  let section: Section = 'steps'
  let afterBlank = true

  for (const raw of lines) {
    const line = clean(raw)
    if (!line) {
      afterBlank = true
      continue
    }
    const numbered = NUMBERED.exec(line)
    const startsRecipe = hasNumberedNames
      ? numbered !== null &&
        isName(line) &&
        (current === null || (afterBlank && Number(numbered[1]) === number + 1))
      : current === null
    afterBlank = false

    if (startsRecipe) {
      number = numbered ? Number(numbered[1]) : 0
      current = { name: withoutNote(numbered ? numbered[2] : line), ingredients: [], steps: [] }
      recipes.push(current)
      section = 'steps'
      continue
    }
    if (!current) continue
    if (INGREDIENTS.test(line)) {
      section = 'ingredients'
      continue
    }
    if (STEPS.test(line)) {
      section = 'steps'
      continue
    }
    const content = clean(line.replace(BULLET, ''))
    if (content) current[section].push(content)
  }
  return recipes.filter((recipe) => recipe.name)
}

/** Eine nummerierte, kurze Zeile ohne Satzzeichen am Ende sieht nach einem Rezeptnamen aus. */
function isName(line: string): boolean {
  const match = NUMBERED.exec(line)
  if (!match) return false
  const name = withoutNote(match[2])
  return name.length > 0 && name.length <= MAX_NAME_LENGTH && !/[.:!?,;]$/.test(name)
}

/** Kürzt auf die Grenzen des Backends, damit ein langer Text nicht am Speichern scheitert. */
export function withinLimits(recipe: ParsedRecipe): ParsedRecipe {
  return {
    name: recipe.name.slice(0, RECIPE_LIMITS.name),
    ingredients: recipe.ingredients
      .slice(0, RECIPE_LIMITS.lines)
      .map((line) => line.slice(0, RECIPE_LIMITS.ingredient)),
    steps: recipe.steps
      .slice(0, RECIPE_LIMITS.lines)
      .map((line) => line.slice(0, RECIPE_LIMITS.step)),
  }
}
