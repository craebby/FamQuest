import { describe, expect, it } from 'vitest'

import { formatAmount, scaleIngredient, servingsIn } from './servings'

describe('servingsIn', () => {
  it.each([
    ['für 4 Personen', 4],
    ['Für 4 Pers.', 4],
    ['4 Portionen', 4],
    ['Portionen: 2', 2],
    ['Zutaten für 6 Personen:', 6],
    ['Zutaten (für 3 Portionen)', 3],
    ['Serves 4', 4],
    ['serves 4-6', 4],
    ['Makes 8 servings', 8],
    ['for 2 people', 2],
  ])('„%s“ → %i', (line, count) => {
    expect(servingsIn(line)).toBe(count)
  })

  it.each(['4 Eier', 'Für den Teig', 'Portionen', 'für 0 Personen', 'für 99 Personen', ''])(
    'erkennt in „%s“ keine Portionen',
    (line) => {
      expect(servingsIn(line)).toBeNull()
    },
  )
})

describe('scaleIngredient', () => {
  it('rechnet die Menge am Anfang um und lässt den Rest stehen', () => {
    expect(scaleIngredient('ca. 600 g Pellkartoffeln', 1.5, ',')).toBe('ca. 900 g Pellkartoffeln')
    expect(scaleIngredient('8 Eier', 0.5, ',')).toBe('4 Eier')
    expect(scaleIngredient('1 Zwiebel', 0.5, ',')).toBe('½ Zwiebel')
    expect(scaleIngredient('1,5 l Brühe', 2, ',')).toBe('3 l Brühe')
    expect(scaleIngredient('1 l Brühe', 1.5, ',')).toBe('1,5 l Brühe')
    expect(scaleIngredient('1 cup milk', 1.5, '.')).toBe('1.5 cup milk')
    expect(scaleIngredient('½ TL Salz', 2, ',')).toBe('1 TL Salz')
    expect(scaleIngredient('1/2 Bund Petersilie', 3, ',')).toBe('1,5 Bund Petersilie')
    expect(scaleIngredient('2-3 Karotten', 2, ',')).toBe('4-6 Karotten')
    expect(scaleIngredient('600g Hack', 0.5, ',')).toBe('300g Hack')
  })

  it('lässt Zutaten ohne Menge und Faktor 1 unverändert', () => {
    expect(scaleIngredient('Salz und Pfeffer', 2, ',')).toBe('Salz und Pfeffer')
    expect(scaleIngredient('1,25 kg Mehl', 1, ',')).toBe('1,25 kg Mehl')
  })
})

describe('formatAmount', () => {
  it('rundet gut lesbar und nie auf 0', () => {
    expect(formatAmount(0.1, ',')).toBe('¼')
    expect(formatAmount(0.75, ',')).toBe('¾')
    expect(formatAmount(2.3, ',')).toBe('2,5')
    expect(formatAmount(12.4, ',')).toBe('12')
    expect(formatAmount(187.5, ',')).toBe('190')
  })
})
