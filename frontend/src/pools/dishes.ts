import type { TFunction } from 'i18next'

import { iconId } from '../icons/catalog'

export interface DishTemplate {
  /** Schlüssel für den Namen in locales/<sprache>/pool.json (`dishes.<id>`). */
  id: string
  /** Name im Icon-Katalog (src/icons/categories.json). */
  icon: string
}

/**
 * Gängige Familiengerichte als Vorschläge beim Eintippen im Essensplan. Übernommen wird der Name
 * in der aktuellen Sprache; danach ist es ein ganz normales Gericht der Familie.
 */
export const DISH_POOL: readonly DishTemplate[] = [
  { id: 'pasta_tomato', icon: 'spaghetti' },
  { id: 'pasta', icon: 'spaghetti' },
  { id: 'bolognese', icon: 'spaghetti' },
  { id: 'lasagne', icon: 'shallow-pan-of-food' },
  { id: 'bake', icon: 'shallow-pan-of-food' },
  { id: 'cheese_spaetzle', icon: 'cheese-wedge' },
  { id: 'pizza', icon: 'pizza' },
  { id: 'burger', icon: 'hamburger' },
  { id: 'schnitzel', icon: 'cut-of-meat' },
  { id: 'chicken', icon: 'poultry-leg' },
  { id: 'nuggets', icon: 'poultry-leg' },
  { id: 'meatballs', icon: 'meat-on-bone' },
  { id: 'bbq', icon: 'meat-on-bone' },
  { id: 'sausages', icon: 'hot-dog' },
  { id: 'hot_dog', icon: 'hot-dog' },
  { id: 'fish_fingers', icon: 'fish' },
  { id: 'salmon', icon: 'fish' },
  { id: 'fries', icon: 'french-fries' },
  { id: 'mashed', icon: 'potato' },
  { id: 'fried_potatoes', icon: 'potato' },
  { id: 'potatoes_quark', icon: 'potato' },
  { id: 'baked_potato', icon: 'roasted-sweet-potato' },
  { id: 'stew', icon: 'pot-of-food' },
  { id: 'goulash', icon: 'pot-of-food' },
  { id: 'noodle_soup', icon: 'steaming-bowl' },
  { id: 'tomato_soup', icon: 'tomato' },
  { id: 'curry', icon: 'curry-rice' },
  { id: 'fried_rice', icon: 'cooked-rice' },
  { id: 'rice_pudding', icon: 'cooked-rice' },
  { id: 'chili', icon: 'hot-pepper' },
  { id: 'dumplings', icon: 'dumpling' },
  { id: 'tortellini', icon: 'dumpling' },
  { id: 'tacos', icon: 'taco' },
  { id: 'wraps', icon: 'burrito' },
  { id: 'doner', icon: 'stuffed-flatbread' },
  { id: 'falafel', icon: 'falafel' },
  { id: 'tarte_flambee', icon: 'flatbread' },
  { id: 'sushi', icon: 'sushi' },
  { id: 'raclette', icon: 'fondue' },
  { id: 'pancakes', icon: 'pancakes' },
  { id: 'waffles', icon: 'waffle' },
  { id: 'spinach', icon: 'leafy-green' },
  { id: 'veggie_pan', icon: 'bell-pepper' },
  { id: 'scrambled_eggs', icon: 'cooking' },
  { id: 'salad', icon: 'green-salad' },
  { id: 'bread', icon: 'bread' },
  { id: 'toast', icon: 'sandwich' },
  { id: 'takeaway', icon: 'takeout-box' },
  { id: 'leftovers', icon: 'takeout-box' },
]

export const dishTemplateName = (t: TFunction, template: DishTemplate) =>
  t(`dishes.${template.id}`, { ns: 'pool' })

export const dishTemplateIcon = (template: DishTemplate) => iconId(template.icon)
