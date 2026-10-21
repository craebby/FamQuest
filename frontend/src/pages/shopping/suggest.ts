import type { TFunction } from 'i18next'

import type { ShoppingItem } from '../../api/shopping'
import { iconId } from '../../icons/catalog'
import { filterSuggestions, iconForTyped, iconsOf } from '../../nameSuggest'
import { GROCERY_POOL, groceryTemplateIcon, groceryTemplateName } from '../../pools/groceries'
import { STORE_ITEM_ICONS, autoArea } from './areas'

/** Ohne passendes Symbol: Einkaufstüten. */
export const DEFAULT_ITEM_ICON = iconId('shopping-bags')

// Beim automatischen Symbol zählt, was man einkauft, keine Aufgaben-Symbole wie Bett oder Schule.
const SHOPPING_ICONS = iconsOf(['groceries', 'food', 'dishes', 'hygiene', 'household'])

export interface ItemSuggestion {
  name: string
  icon: string
  /** Nur bei Artikeln der Familie (bearbeitbar); Standardartikel haben keine. */
  item_id?: number
}

const templates = (t: TFunction) =>
  GROCERY_POOL.map((template) => ({
    name: groceryTemplateName(t, template),
    icon: groceryTemplateIcon(template),
  }))

/**
 * Symbol zu einem eingetippten Namen: ein bekannter Artikel behält seins, ein Standardartikel
 * bringt seins mit, sonst das erste passende Symbol („Vollkornbrot“ → Brot). Ohne passendes
 * Symbol das des Ladens, wenn es nicht der Supermarkt ist („Schrauben“ → Werkzeugkasten).
 */
export function iconForItem(t: TFunction, name: string, items: readonly ShoppingItem[]): string {
  const icon = iconForTyped(name, [...items, ...templates(t)], SHOPPING_ICONS, DEFAULT_ITEM_ICON)
  if (icon !== DEFAULT_ITEM_ICON) return icon
  const store = STORE_ITEM_ICONS[autoArea(name, icon)]
  return store ? iconId(store) : icon
}

/**
 * Vorschläge zum Antippen: erst die Artikel der Familie (häufig gekaufte zuerst), dann
 * Standardartikel. Mit Suchbegriff nur, was jedes eingetippte Wort enthält.
 */
export function itemSuggestions(
  t: TFunction,
  query: string,
  items: readonly ShoppingItem[],
): ItemSuggestion[] {
  return filterSuggestions<ItemSuggestion>(query, [
    ...items.map((item) => ({
      name: item.name,
      icon: item.icon,
      item_id: item.id,
    })),
    ...templates(t),
  ])
}
