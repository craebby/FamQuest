import { beforeEach, describe, expect, it } from 'vitest'

import i18n from './i18n'
import { recurrenceSummary } from './recurrence'

const summary = (recurrence: Parameters<typeof recurrenceSummary>[2]) =>
  recurrenceSummary(i18n.t, i18n.language, recurrence)

describe('Wiederholung als Text', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('de')
  })

  it('fasst übliche Muster zusammen', () => {
    expect(summary({ kind: 'daily' })).toBe('Täglich')
    expect(summary({ kind: 'weekly', weekdays: [1, 2, 3, 4, 5] })).toBe('Montag bis Freitag')
    expect(summary({ kind: 'weekly', weekdays: [6, 7] })).toBe('Am Wochenende')
    expect(summary({ kind: 'weekly', weekdays: [1, 2, 3, 4, 5, 6, 7] })).toBe('Täglich')
  })

  it('listet einzelne Wochentage in Wochenreihenfolge', () => {
    expect(summary({ kind: 'weekly', weekdays: [5, 1, 3] })).toBe('Mo, Mi und Fr')
  })

  it('nennt das Datum bei einmaligen Aufgaben', async () => {
    expect(summary({ kind: 'once', date: '2026-10-03' })).toBe('Am 03.10.2026')
    await i18n.changeLanguage('en')
    expect(summary({ kind: 'weekly', weekdays: [7, 1] })).toBe('Sun and Mon')
  })
})
