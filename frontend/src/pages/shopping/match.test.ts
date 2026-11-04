import { describe, expect, it } from 'vitest'

import { sameArticle } from './match'

describe('derselbe Artikel', () => {
  it.each([
    ['Paprika', 'Paprika'],
    ['paprika', 'Paprika'],
    ['rote Paprika', 'Paprika'],
    ['Paprikaschoten', 'Paprika'],
    ['Zwiebeln', 'Zwiebel'],
    ['rote Zwiebeln', 'Zwiebel'],
    ['Knoblauchzehen', 'Knoblauch'],
    ['Tomaten', 'Tomate'],
    ['Eier', 'Eier'],
    ['eggs', 'egg'],
  ])('%s = %s', (a, b) => {
    expect(sameArticle(a, b)).toBe(true)
    expect(sameArticle(b, a)).toBe(true)
  })

  it.each([
    ['gehackte Tomaten', 'Tomaten'],
    ['Spinat TK', 'Spinat'],
    ['Paprikapulver', 'Paprika'],
    ['rote Paprika', 'gelbe Paprika'],
    ['Kokosmilch', 'Milch'],
    ['Reis', 'Eis'],
    ['Eis', 'Eier'],
    ['Erbsen', 'Erbse TK'],
  ])('%s ≠ %s', (a, b) => {
    expect(sameArticle(a, b)).toBe(false)
  })
})
