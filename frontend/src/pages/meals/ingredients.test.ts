import { describe, expect, it } from 'vitest'

import { combineIngredients, isPantry, parseIngredient } from './ingredients'

describe('parseIngredient', () => {
  it.each([
    ['ca. 600 g Pellkartoffeln', 'Pellkartoffeln', 'ca. 600 g'],
    ['1 Zwiebel', 'Zwiebel', '1'],
    ['ca. 300 g TK-Gemüse', 'TK-Gemüse', 'ca. 300 g'],
    ['8 Eier', 'Eier', '8'],
    ['1 Handvoll geriebener Käse', 'geriebener Käse', '1 Handvoll'],
    ['1 Packung passierte Tomaten', 'passierte Tomaten', '1 Packung'],
    ['2-3 EL Sojasauce', 'Sojasauce', '2-3 EL'],
    ['1,5 l Milch', 'Milch', '1,5 l'],
    ['½ TL Paprikapulver', 'Paprikapulver', '½ TL'],
    ['2 tbsp soy sauce', 'soy sauce', '2 tbsp'],
    ['Salz, Pfeffer', 'Salz, Pfeffer', ''],
    ['Butter zum Braten', 'Butter zum Braten', ''],
    // Ohne Namen nach der Menge bleibt alles der Name.
    ['500 g', '500 g', ''],
    // „g“ gehört nur als eigenes Wort zur Menge.
    ['2 Gurken', 'Gurken', '2'],
    // Ein Zusatz in Klammern am Ende (so kommen Zutaten aus Mealie) fällt weg.
    ['1 Stück Paprika (ca. 180 g rot)', 'Paprika', '1 Stück'],
    ['Salz (nach Geschmack)', 'Salz', ''],
  ])('%s', (line, name, note) => {
    expect(parseIngredient(line)).toEqual({ name, note })
  })
})

describe('combineIngredients', () => {
  it('fasst gleiche Zutaten zusammen und hängt die Mengen an', () => {
    expect(combineIngredients(['1 Zwiebel', '400 g Hack', '2 zwiebel', 'Käse', 'Käse'])).toEqual([
      { name: 'Zwiebel', note: '1 + 2', recipes: [] },
      { name: 'Hack', note: '400 g', recipes: [] },
      { name: 'Käse', note: '', recipes: [] },
    ])
  })

  it('erkennt denselben Artikel in anderer Form und merkt sich die Rezepte', () => {
    expect(
      combineIngredients([
        { line: '1 Paprika', recipe: 'Chili' },
        { line: '2 rote Paprikaschoten', recipe: 'Gemüsepfanne' },
        { line: '1 Dose gehackte Tomaten', recipe: 'Chili' },
        { line: '4 Tomaten', recipe: 'Gemüsepfanne' },
        { line: '2 Zwiebeln', recipe: 'Chili' },
        { line: '1 Zwiebel', recipe: 'Chili' },
      ]),
    ).toEqual([
      { name: 'Paprika', note: '1 + 2', recipes: ['Chili', 'Gemüsepfanne'] },
      { name: 'gehackte Tomaten', note: '1 Dose', recipes: ['Chili'] },
      { name: 'Tomaten', note: '4', recipes: ['Gemüsepfanne'] },
      { name: 'Zwiebeln', note: '2 + 1', recipes: ['Chili'] },
    ])
  })
})

it('kennt, was fast jeder im Haus hat', () => {
  expect(isPantry('Salz')).toBe(true)
  expect(isPantry('Salz, Pfeffer')).toBe(true)
  expect(isPantry('Eier')).toBe(false)
})
