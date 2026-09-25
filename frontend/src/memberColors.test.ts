import { describe, expect, it } from 'vitest'

import { COLOR_TOKENS, FAMILY_COLORS, MEMBER_COLORS } from './memberColors'

// Relative Leuchtdichte und Kontrastverhältnis nach WCAG 2.x.
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((index) => {
    const channel = parseInt(hex.slice(index, index + 2), 16) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

const AA_TEXT = 4.5

describe('Personenfarben', () => {
  it('gibt es genau sieben, alle verschieden', () => {
    expect(MEMBER_COLORS).toHaveLength(7)
    const mains = MEMBER_COLORS.map((color) => COLOR_TOKENS[color].main)
    expect(new Set(mains).size).toBe(7)
  })

  it('Familienfarben umfassen alle Personenfarben und zwei eigene', () => {
    const mains = FAMILY_COLORS.map((color) => COLOR_TOKENS[color].main)
    expect(new Set(mains).size).toBe(MEMBER_COLORS.length + 2)
  })

  for (const color of FAMILY_COLORS) {
    const tokens = COLOR_TOKENS[color]

    it(`${color}: Text auf der Farbe erfüllt WCAG AA`, () => {
      expect(contrast(tokens.onMain, tokens.main)).toBeGreaterThanOrEqual(AA_TEXT)
    })

    it(`${color}: farbiger Text neben der Farbe erfüllt WCAG AA`, () => {
      expect(contrast(tokens.strong, '#ffffff')).toBeGreaterThanOrEqual(AA_TEXT)
      expect(contrast(tokens.strong, tokens.soft)).toBeGreaterThanOrEqual(AA_TEXT)
      expect(contrast('#1e293b', tokens.soft)).toBeGreaterThanOrEqual(AA_TEXT)
    })
  }
})
