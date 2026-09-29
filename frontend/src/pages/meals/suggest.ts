import type { TFunction } from 'i18next'

import type { Dish } from '../../api/meals'
import { iconId } from '../../icons/catalog'
import { filterSuggestions, iconForTyped, iconsOf } from '../../nameSuggest'
import { DISH_POOL, dishTemplateIcon, dishTemplateName } from '../../pools/dishes'

/** Ohne passendes Symbol: Teller mit Besteck. */
export const DEFAULT_DISH_ICON = iconId('fork-and-knife-with-plate')

// Beim automatischen Symbol zählen nur Gerichte und Essen, keine Aufgaben-Symbole.
const FOOD_ICONS = iconsOf(['dishes', 'food'])

export interface DishSuggestion {
  name: string
  icon: string
  image_url: string | null
  /** Nur bei Gerichten der Familie (bearbeitbar); Standardgerichte haben keine. */
  dish_id?: number
}

const templates = (t: TFunction) =>
  DISH_POOL.map((template) => ({
    name: dishTemplateName(t, template),
    icon: dishTemplateIcon(template),
  }))

/**
 * Symbol zu einem eingetippten Namen: ein bekanntes Gericht behält seins, ein Standardgericht
 * bringt seins mit, sonst das erste passende Essens-Symbol („Schnitzel mit Pommes“ → Fleisch).
 */
export function iconForName(t: TFunction, name: string, dishes: readonly Dish[]): string {
  return iconForTyped(name, [...dishes, ...templates(t)], FOOD_ICONS, DEFAULT_DISH_ICON)
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
  return filterSuggestions<DishSuggestion>(query, [
    ...dishes.map((dish) => ({
      name: dish.name,
      icon: dish.icon,
      image_url: dish.image_url,
      dish_id: dish.id,
    })),
    ...templates(t).map((template) => ({ ...template, image_url: null })),
  ])
}
