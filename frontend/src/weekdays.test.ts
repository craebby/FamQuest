import { describe, expect, it } from 'vitest'

import { addDays, formatDate, isoWeekday, todayIn, weekdayName, weekdayOrder } from './weekdays'

describe('Wochentage', () => {
  it('beginnen je nach Sprache am Montag oder Sonntag', () => {
    expect(weekdayOrder('de')).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(weekdayOrder('en-US')).toEqual([7, 1, 2, 3, 4, 5, 6])
  })

  it('werden über Intl benannt', () => {
    expect(weekdayName('de', 1, 'long')).toBe('Montag')
    expect(weekdayName('en', 7, 'long')).toBe('Sunday')
  })

  it('formatieren Datumswerte ohne Zeitzonen-Verschiebung', () => {
    expect(formatDate('de', '2026-10-03')).toBe('03.10.2026')
  })

  it('berechnen „heute“ in der Zeitzone der Familie', () => {
    const lateEvening = new Date('2026-09-25T22:30:00Z')
    expect(todayIn('Europe/Berlin', lateEvening)).toBe('2026-09-26')
    expect(todayIn('America/New_York', lateEvening)).toBe('2026-09-25')
  })

  it('rechnet mit Kalendertagen über Monats- und Jahresgrenzen', () => {
    expect(addDays('2026-09-28', 6)).toBe('2026-10-04')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(isoWeekday('2026-09-28')).toBe(1)
    expect(isoWeekday('2026-10-04')).toBe(7)
  })
})
