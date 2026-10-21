import { describe, expect, it } from 'vitest'

import type { ListItem } from '../../api/shopping'
import i18n from '../../i18n'
import { iconId } from '../../icons/catalog'
import { GROCERY_POOL } from '../../pools/groceries'
import { type Area, autoArea, groupItems, itemArea } from './areas'

const BAGS = iconId('shopping-bags')

/** Wo die Standardartikel landen sollen, egal in welcher Sprache. */
const POOL_AREAS: Record<string, Area> = {
  milk: 'chilled',
  bread: 'bakery',
  rolls: 'bakery',
  butter: 'chilled',
  cheese: 'chilled',
  cold_cuts: 'chilled',
  eggs: 'chilled',
  yogurt: 'chilled',
  cereal: 'pantry',
  jam: 'pantry',
  honey: 'pantry',
  apples: 'produce',
  bananas: 'produce',
  pears: 'produce',
  grapes: 'produce',
  strawberries: 'produce',
  oranges: 'produce',
  lemons: 'produce',
  kiwis: 'produce',
  tomatoes: 'produce',
  cucumber: 'produce',
  peppers: 'produce',
  carrots: 'produce',
  potatoes: 'produce',
  onions: 'produce',
  garlic: 'produce',
  salad: 'produce',
  broccoli: 'produce',
  mushrooms: 'produce',
  corn: 'produce',
  avocado: 'produce',
  pasta: 'pantry',
  rice: 'pantry',
  minced_meat: 'chilled',
  chicken: 'chilled',
  sausages: 'chilled',
  fish: 'chilled',
  frozen_pizza: 'frozen',
  canned_tomatoes: 'pantry',
  oil: 'pantry',
  salt: 'pantry',
  coffee: 'pantry',
  tea: 'pantry',
  juice: 'drinks',
  water: 'drinks',
  beer: 'drinks',
  wine: 'drinks',
  chocolate: 'sweets',
  biscuits: 'sweets',
  nuts: 'sweets',
  ice_cream: 'frozen',
  toilet_paper: 'drugstore',
  kitchen_roll: 'drugstore',
  toothpaste: 'drugstore',
  shampoo: 'drugstore',
  soap: 'drugstore',
  detergent: 'drugstore',
  dish_soap: 'drugstore',
  dishwasher_tabs: 'drugstore',
  bin_bags: 'household',
  diapers: 'drugstore',
  plasters: 'drugstore',
  batteries: 'household',
  cat_food: 'household',
  dog_food: 'household',
}

const item = (overrides: Partial<ListItem>): ListItem => ({
  id: 1,
  name: 'Milch',
  icon: BAGS,
  note: null,
  checked: false,
  area: null,
  position: null,
  ...overrides,
})

describe('automatischer Bereich', () => {
  it('ordnet jeden Standardartikel in beiden Sprachen richtig ein', () => {
    expect(Object.keys(POOL_AREAS).sort()).toEqual(GROCERY_POOL.map(({ id }) => id).sort())
    for (const lng of ['de', 'en']) {
      for (const template of GROCERY_POOL) {
        const name = i18n.t(`groceries.${template.id}`, { ns: 'pool', lng })
        expect(autoArea(name, iconId(template.icon)), `${lng}: ${name}`).toBe(
          POOL_AREAS[template.id],
        )
      }
    }
  })

  it.each<[string, Area]>([
    // Das letzte Wort entscheidet.
    ['Milchschokolade', 'sweets'],
    ['Orangensaft', 'drinks'],
    ['Erdbeerjoghurt', 'chilled'],
    ['Butterkekse', 'sweets'],
    ['Kartoffelchips', 'sweets'],
    ['Erdnussbutter', 'pantry'],
    ['Wassermelone', 'produce'],
    ['Olivenöl', 'pantry'],
    ['Kräutertee', 'pantry'],
    ['Eistee', 'drinks'],
    ['Speiseeis', 'frozen'],
    ['Reiswaffeln', 'pantry'],
    ['Glühbirne', 'hardware'],
    ['Holzkohle', 'household'],
    ['Steckdosenleiste', 'hardware'],
    ['Sonnenmilch', 'drugstore'],
    ['Nagellack', 'drugstore'],
    ['Gummihandschuhe', 'drugstore'],
    // Kurze Stichwörter nur am Wortende.
    ['Teelichter', 'household'],
    ['peanut butter', 'pantry'],
    ['orange juice', 'drinks'],
    ['dishwasher tablets', 'drugstore'],
    // TK und Tiefkühl gehen vor.
    ['TK-Erbsen', 'frozen'],
    ['Tiefkühlgemüse', 'frozen'],
    ['frozen peas', 'frozen'],
    // Andere Läden.
    ['Schrauben', 'hardware'],
    ['Blumenerde', 'hardware'],
    ['Druckerpatronen', 'online'],
    ['USB-Kabel', 'online'],
    ['Hose für Paula', 'online'],
    ['phone case', 'online'],
    ['Wattestäbchen', 'drugstore'],
  ])('%s → %s', (name, area) => {
    expect(autoArea(name, BAGS)).toBe(area)
  })

  it('nimmt ohne Stichwort das Symbol, sonst „Sonstiges“', () => {
    expect(autoArea('Lieblingsdings', iconId('cheese-wedge'))).toBe('chilled')
    expect(autoArea('Lieblingsdings', BAGS)).toBe('other')
  })

  it('lässt einen von Hand verschobenen Artikel, wo er ist', () => {
    expect(itemArea(item({ name: 'Milch', area: 'drugstore' }))).toBe('drugstore')
    expect(itemArea(item({ name: 'Milch' }))).toBe('chilled')
  })
})

describe('Gruppen', () => {
  it('ordnet nach Laden, Bereich im Laufweg und von Hand gesetzter Reihenfolge', () => {
    const items = [
      item({ id: 1, name: 'Milch' }),
      item({ id: 2, name: 'Schrauben' }),
      item({ id: 3, name: 'Äpfel' }),
      item({ id: 4, name: 'Joghurt', position: 1 }),
      item({ id: 5, name: 'Käse', position: 0 }),
      item({ id: 6, name: 'Zahnpasta' }),
    ]

    const groups = groupItems(items).map(({ store, areas }) => [
      store,
      areas.map(({ area, items }) => [area, items.map(({ name }) => name)]),
    ])

    expect(groups).toEqual([
      [
        'supermarket',
        [
          ['produce', ['Äpfel']],
          // Erst von Hand sortierte, dann der Rest in der Reihenfolge der Liste.
          ['chilled', ['Käse', 'Joghurt', 'Milch']],
        ],
      ],
      ['drugstore', [['drugstore', ['Zahnpasta']]]],
      ['hardware', [['hardware', ['Schrauben']]]],
    ])
  })
})
