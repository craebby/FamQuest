import { describe, expect, it } from 'vitest'

import { clockOffset, isNightTime, minutesOfDay, parseClockTime } from './night'

describe('Nachtfenster', () => {
  it('liest Uhrzeiten und lehnt Ungültiges ab', () => {
    expect(parseClockTime('06:30')).toBe(390)
    expect(parseClockTime('23:59')).toBe(1439)
    expect(parseClockTime('24:00')).toBeNull()
    expect(parseClockTime('6:30')).toBeNull()
  })

  it('rechnet in der Zeitzone der Familie', () => {
    // 21:30 UTC ist im Sommer 23:30 in Berlin und 17:30 in New York.
    const now = new Date('2026-07-01T21:30:00Z')
    expect(minutesOfDay(now, 'Europe/Berlin')).toBe(23 * 60 + 30)
    expect(isNightTime(now, '22:00', '06:00', 'Europe/Berlin')).toBe(true)
    expect(isNightTime(now, '22:00', '06:00', 'America/New_York')).toBe(false)
  })

  it('geht über Mitternacht, Beginn gehört dazu, Ende nicht', () => {
    const at = (time: string) => new Date(`2026-01-15T${time}:00Z`)
    const night = (time: string) => isNightTime(at(time), '22:00', '06:00', 'UTC')
    expect(night('21:59')).toBe(false)
    expect(night('22:00')).toBe(true)
    expect(night('00:00')).toBe(true)
    expect(night('05:59')).toBe(true)
    expect(night('06:00')).toBe(false)
    expect(night('12:00')).toBe(false)
  })

  it('kennt Fenster am selben Tag und leere Fenster', () => {
    const noon = new Date('2026-01-15T12:30:00Z')
    expect(isNightTime(noon, '12:00', '14:00', 'UTC')).toBe(true)
    expect(isNightTime(noon, '13:00', '14:00', 'UTC')).toBe(false)
    expect(isNightTime(noon, '12:00', '12:00', 'UTC')).toBe(false)
  })

  it('verschiebt die gedimmte Uhr alle 5 Minuten, aber nur wenig', () => {
    const start = new Date('2026-01-15T00:00:00Z').getTime()
    const offsets = Array.from({ length: 12 }, (_, step) =>
      clockOffset(new Date(start + step * 5 * 60 * 1000)),
    )
    expect(clockOffset(new Date(start + 4 * 60 * 1000))).toEqual(offsets[0])
    expect(new Set(offsets.map(({ x, y }) => `${x},${y}`)).size).toBeGreaterThan(6)
    for (const { x, y } of offsets) {
      expect(Math.abs(x)).toBeLessThanOrEqual(4)
      expect(Math.abs(y)).toBeLessThanOrEqual(3)
    }
  })
})
