import { describe, expect, it } from 'vitest'

import { parseRecipes, withinLimits } from './parseRecipes'

const WITH_SECTIONS = `1. Rührei-Pfanne mit Pellkartoffeln (heute)

Zutaten

ca. 600 g Pellkartoffeln
1 Zwiebel
- ca. 300 g TK-Gemüse
• 8 Eier

Zubereitung

Pellkartoffeln in Scheiben in Öl 8-10 Min anbraten.
1. Eier verquirlen, drübergießen und stocken lassen.
2. Käse drauf

2. Hähnchen-Wraps

Zutaten:
Tortillas

Zubereitung:
Tortillas kurz erwärmen.`

const WITHOUT_SECTIONS = `1. Rührei-Pfanne mit Pellkartoffeln (heute)

Pellkartoffeln in Scheiben in Öl 8-10 Min anbraten.
Käse drauf, Deckel drauf, 2 Min ziehen lassen.

2. Hähnchen-Gemüse-Pfanne mit Reis

Reis aufsetzen (1 Teil Reis, 2 Teile Wasser, 12-15 Min).
Hähnchenstreifen scharf anbraten (5-6 Min) und rausnehmen.

3. One-Pot-Nudeln mit Hack

400 g Hack krümelig anbraten.`

describe('parseRecipes', () => {
  it('teilt nummerierte Rezepte in Zutaten und Zubereitung', () => {
    expect(parseRecipes(WITH_SECTIONS)).toEqual([
      {
        name: 'Rührei-Pfanne mit Pellkartoffeln',
        ingredients: ['ca. 600 g Pellkartoffeln', '1 Zwiebel', 'ca. 300 g TK-Gemüse', '8 Eier'],
        steps: [
          'Pellkartoffeln in Scheiben in Öl 8-10 Min anbraten.',
          'Eier verquirlen, drübergießen und stocken lassen.',
          // Nummerierter Schritt ohne Leerzeile davor bleibt ein Schritt.
          'Käse drauf',
        ],
      },
      { name: 'Hähnchen-Wraps', ingredients: ['Tortillas'], steps: ['Tortillas kurz erwärmen.'] },
    ])
  })

  it('nimmt ohne Überschriften alles als Zubereitung', () => {
    const recipes = parseRecipes(WITHOUT_SECTIONS)
    expect(recipes.map((recipe) => recipe.name)).toEqual([
      'Rührei-Pfanne mit Pellkartoffeln',
      'Hähnchen-Gemüse-Pfanne mit Reis',
      'One-Pot-Nudeln mit Hack',
    ])
    expect(recipes[1]).toEqual({
      name: 'Hähnchen-Gemüse-Pfanne mit Reis',
      ingredients: [],
      steps: [
        'Reis aufsetzen (1 Teil Reis, 2 Teile Wasser, 12-15 Min).',
        'Hähnchenstreifen scharf anbraten (5-6 Min) und rausnehmen.',
      ],
    })
  })

  it('macht aus einem Text ohne Nummern ein Rezept mit der ersten Zeile als Name', () => {
    expect(
      parseRecipes('\nKartoffelsuppe\nZutaten\n1 kg Kartoffeln\nZubereitung\nKochen.'),
    ).toEqual([{ name: 'Kartoffelsuppe', ingredients: ['1 kg Kartoffeln'], steps: ['Kochen.'] }])
    expect(parseRecipes('  \n ')).toEqual([])
  })

  it('beginnt kein neues Rezept mit einer Nummer außer der Reihe oder einem Satz', () => {
    const text = `1. Nudeln

1. Wasser kochen.

3. Salz rein

2. Pfannkuchen

Teig rühren.`
    expect(parseRecipes(text)).toEqual([
      { name: 'Nudeln', ingredients: [], steps: ['Wasser kochen.', 'Salz rein'] },
      { name: 'Pfannkuchen', ingredients: [], steps: ['Teig rühren.'] },
    ])
  })

  it('kürzt auf die Grenzen des Servers', () => {
    const long = withinLimits({
      name: 'N'.repeat(150),
      ingredients: Array.from({ length: 70 }, () => 'Z'.repeat(250)),
      steps: ['S'.repeat(1200)],
    })
    expect(long.name).toHaveLength(100)
    expect(long.ingredients).toHaveLength(60)
    expect(long.ingredients[0]).toHaveLength(200)
    expect(long.steps[0]).toHaveLength(1000)
  })
})
