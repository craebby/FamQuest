import type { TFunction } from 'i18next'

import { iconId } from '../icons/catalog'

export interface GroceryTemplate {
  /** Schlüssel für den Namen in locales/<sprache>/pool.json (`groceries.<id>`). */
  id: string
  /** Name im Icon-Katalog (src/icons/categories.json). */
  icon: string
}

/**
 * Häufige Einkäufe als Vorschläge für die Einkaufsliste, grob in der Reihenfolge eines
 * Wocheneinkaufs. Übernommen wird der Name in der aktuellen Sprache; danach ist es ein ganz
 * normaler Artikel der Familie.
 */
export const GROCERY_POOL: readonly GroceryTemplate[] = [
  { id: 'milk', icon: 'glass-of-milk' },
  { id: 'bread', icon: 'bread' },
  { id: 'rolls', icon: 'baguette-bread' },
  { id: 'butter', icon: 'butter' },
  { id: 'cheese', icon: 'cheese-wedge' },
  { id: 'cold_cuts', icon: 'bacon' },
  { id: 'eggs', icon: 'egg' },
  { id: 'yogurt', icon: 'bowl-with-spoon' },
  { id: 'cereal', icon: 'bowl-with-spoon' },
  { id: 'jam', icon: 'jar' },
  { id: 'honey', icon: 'honey-pot' },
  { id: 'apples', icon: 'red-apple' },
  { id: 'bananas', icon: 'banana' },
  { id: 'pears', icon: 'pear' },
  { id: 'grapes', icon: 'grapes' },
  { id: 'strawberries', icon: 'strawberry' },
  { id: 'oranges', icon: 'tangerine' },
  { id: 'lemons', icon: 'lemon' },
  { id: 'kiwis', icon: 'kiwi-fruit' },
  { id: 'tomatoes', icon: 'tomato' },
  { id: 'cucumber', icon: 'cucumber' },
  { id: 'peppers', icon: 'bell-pepper' },
  { id: 'carrots', icon: 'carrot' },
  { id: 'potatoes', icon: 'potato' },
  { id: 'onions', icon: 'onion' },
  { id: 'garlic', icon: 'garlic' },
  { id: 'salad', icon: 'green-salad' },
  { id: 'broccoli', icon: 'broccoli' },
  { id: 'mushrooms', icon: 'mushroom' },
  { id: 'corn', icon: 'ear-of-corn' },
  { id: 'avocado', icon: 'avocado' },
  { id: 'pasta', icon: 'spaghetti' },
  { id: 'rice', icon: 'cooked-rice' },
  { id: 'minced_meat', icon: 'cut-of-meat' },
  { id: 'chicken', icon: 'poultry-leg' },
  { id: 'sausages', icon: 'hot-dog' },
  { id: 'fish', icon: 'fish' },
  { id: 'frozen_pizza', icon: 'pizza' },
  { id: 'canned_tomatoes', icon: 'canned-food' },
  { id: 'oil', icon: 'olive' },
  { id: 'salt', icon: 'salt' },
  { id: 'coffee', icon: 'hot-beverage' },
  { id: 'tea', icon: 'teacup-without-handle' },
  { id: 'juice', icon: 'beverage-box' },
  { id: 'water', icon: 'potable-water' },
  { id: 'beer', icon: 'beer-mug' },
  { id: 'wine', icon: 'wine-glass' },
  { id: 'chocolate', icon: 'chocolate-bar' },
  { id: 'biscuits', icon: 'cookie' },
  { id: 'nuts', icon: 'peanuts' },
  { id: 'ice_cream', icon: 'ice-cream' },
  { id: 'toilet_paper', icon: 'roll-of-paper' },
  { id: 'kitchen_roll', icon: 'roll-of-paper' },
  { id: 'toothpaste', icon: 'toothbrush' },
  { id: 'shampoo', icon: 'lotion-bottle' },
  { id: 'soap', icon: 'soap' },
  { id: 'detergent', icon: 'bubbles' },
  { id: 'dish_soap', icon: 'sponge' },
  { id: 'dishwasher_tabs', icon: 'bubbles' },
  { id: 'bin_bags', icon: 'wastebasket' },
  { id: 'diapers', icon: 'baby' },
  { id: 'plasters', icon: 'adhesive-bandage' },
  { id: 'batteries', icon: 'battery' },
  { id: 'cat_food', icon: 'cat-face' },
  { id: 'dog_food', icon: 'dog-face' },
]

export const groceryTemplateName = (t: TFunction, template: GroceryTemplate) =>
  t(`groceries.${template.id}`, { ns: 'pool' })

export const groceryTemplateIcon = (template: GroceryTemplate) => iconId(template.icon)
