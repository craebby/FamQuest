// Muss zu MEMBER_COLORS im Backend passen (backend/app/schemas.py).
export const MEMBER_COLORS = ['orange', 'blue', 'purple', 'green', 'red', 'teal', 'yellow'] as const
export type MemberColor = (typeof MEMBER_COLORS)[number]
// Farbe der Familie im Kalender; muss zu FAMILY_COLORS im Backend passen.
// Rosa und Grau gibt es nur für die Familie, damit sie sich immer von allen Personen abhebt.
export const FAMILY_COLORS = [...MEMBER_COLORS, 'pink', 'slate'] as const
export type FamilyColor = (typeof FAMILY_COLORS)[number]

export interface ColorTokens {
  /** Kräftige Personenfarbe für Ringe, Balken und Flächen. */
  main: string
  /** Textfarbe auf `main` (Kontrast ≥ 4,5:1). */
  onMain: string
  /** Dunkle Variante für farbigen Text auf Weiß oder `soft` (Kontrast ≥ 4,5:1). */
  strong: string
  /** Helle Tönung für Hintergründe von Karten. */
  soft: string
}

const DARK_TEXT = '#1e293b'
const LIGHT_TEXT = '#ffffff'

export const COLOR_TOKENS: Record<FamilyColor, ColorTokens> = {
  orange: { main: '#f97316', onMain: DARK_TEXT, strong: '#9a3412', soft: '#ffedd5' },
  blue: { main: '#2563eb', onMain: LIGHT_TEXT, strong: '#1d4ed8', soft: '#dbeafe' },
  purple: { main: '#9333ea', onMain: LIGHT_TEXT, strong: '#7e22ce', soft: '#f3e8ff' },
  green: { main: '#22c55e', onMain: DARK_TEXT, strong: '#15803d', soft: '#dcfce7' },
  red: { main: '#dc2626', onMain: LIGHT_TEXT, strong: '#b91c1c', soft: '#fee2e2' },
  teal: { main: '#14b8a6', onMain: DARK_TEXT, strong: '#0f766e', soft: '#ccfbf1' },
  yellow: { main: '#eab308', onMain: DARK_TEXT, strong: '#854d0e', soft: '#fef9c3' },
  pink: { main: '#db2777', onMain: LIGHT_TEXT, strong: '#be185d', soft: '#fce7f3' },
  slate: { main: '#64748b', onMain: LIGHT_TEXT, strong: '#475569', soft: '#f1f5f9' },
}

export function colorTokens(color: string): ColorTokens {
  return COLOR_TOKENS[color as FamilyColor] ?? COLOR_TOKENS.orange
}
