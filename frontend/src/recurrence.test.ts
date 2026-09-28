import { beforeEach, describe, expect, it } from 'vitest'

import i18n from './i18n'
import { occursOn, recurrenceSummary } from './recurrence'

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

describe('Aufgabe an einem Tag', () => {
  // 2026-09-28 ist ein Montag.
  it('prüft Wiederholungen gegen das Datum', () => {
    expect(occursOn({ kind: 'daily' }, '2026-09-28')).toBe(true)
    expect(occursOn({ kind: 'weekly', weekdays: [1, 3] }, '2026-09-28')).toBe(true)
    expect(occursOn({ kind: 'weekly', weekdays: [6, 7] }, '2026-09-28')).toBe(false)
    expect(occursOn({ kind: 'once', date: '2026-09-28' }, '2026-09-28')).toBe(true)
    expect(occursOn({ kind: 'once', date: '2026-10-05' }, '2026-09-28')).toBe(false)
    expect(occursOn({ kind: 'flexible', interval_days: 7, date: '2026-10-05' }, '2026-09-28')).toBe(
      true,
    )
  })
})
