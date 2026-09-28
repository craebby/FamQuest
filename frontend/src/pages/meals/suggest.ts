import type { TFunction } from 'i18next'

import type { Dish } from '../../api/meals'
import { ICON_CATEGORIES, iconId, normalize, searchIcons } from '../../icons/catalog'
import { DISH_POOL, dishTemplateIcon, dishTemplateName } from '../../pools/dishes'

/** Ohne passendes Symbol: Teller mit Besteck. */
export const DEFAULT_DISH_ICON = iconId('fork-and-knife-with-plate')

// Beim automatischen Symbol zählen nur Gerichte und Essen, keine Aufgaben-Symbole.
const FOOD_ICONS = new Set(
  ICON_CATEGORIES.filter((category) => ['dishes', 'food'].includes(category.id)).flatMap(
    (category) => category.icons,
  ),
)

export interface DishSuggestion {
  name: string
  icon: string
  image_url: string | null
  /** Nur bei Gerichten der Familie (bearbeitbar); Standardgerichte haben keine. */
  dish_id?: number
}

function foodIcon(query: string): string | null {
  const match = searchIcons(query).find((name) => FOOD_ICONS.has(name))
  return match ? iconId(match) : null
}

/**
 * Symbol zu einem eingetippten Namen: ein bekanntes Gericht behält seins, ein Standardgericht
 * bringt seins mit, sonst das erste passende Essens-Symbol („Schnitzel mit Pommes“ → Fleisch).
 */
export function iconForName(t: TFunction, name: string, dishes: readonly Dish[]): string {
  const key = normalize(name.trim())
  if (!key) return DEFAULT_DISH_ICON
  const dish = dishes.find((entry) => normalize(entry.name) === key)
  if (dish) return dish.icon
  const template = DISH_POOL.find((entry) => normalize(dishTemplateName(t, entry)) === key)
  if (template) return dishTemplateIcon(template)
  const words = name.split(/\s+/).filter((word) => word.length >= 3)
  for (const query of [name, ...words]) {
    const icon = foodIcon(query)
    if (icon) return icon
  }
  return DEFAULT_DISH_ICON
}

/**
 * Vorschläge zum Antippen: erst die Gerichte der Familie (zuletzt geplante zuerst), dann
 * Standardgerichte. Mit Suchbegriff nur, was jedes eingetippte Wort enthält.
 */
export function dishSuggestions(
  t: TFunction,
  query: string,
  dishes: readonly Dish[],
): DishSuggestion[] {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  const matches = (name: string) => words.every((word) => normalize(name).includes(word))
  const seen = new Set<string>()
  const result: DishSuggestion[] = []
  const add = (suggestion: DishSuggestion) => {
    const key = normalize(suggestion.name)
    if (seen.has(key) || !matches(suggestion.name)) return
    seen.add(key)
    result.push(suggestion)
  }
  for (const dish of dishes)
    add({ name: dish.name, icon: dish.icon, image_url: dish.image_url, dish_id: dish.id })
  for (const template of DISH_POOL)
    add({ name: dishTemplateName(t, template), icon: dishTemplateIcon(template), image_url: null })
  return result
}
