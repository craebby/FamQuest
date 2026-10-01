import type { TFunction } from 'i18next'

import { CHORE_LEVELS, CHORE_MAX_INTERVAL, type Chore, type ChoreLevel } from './api/chores'

/** Einheiten für den Abstand, mit ihrer Länge in Tagen (Monat und Jahr gerundet). */
export const INTERVAL_UNITS = { day: 1, week: 7, month: 30, year: 365 } as const
export type IntervalUnit = keyof typeof INTERVAL_UNITS
export const INTERVAL_UNIT_NAMES = Object.keys(INTERVAL_UNITS) as IntervalUnit[]

/** Zerlegt Tage in die größte Einheit, die glatt aufgeht: 14 → 2 Wochen, 90 → 3 Monate. */
export function splitInterval(days: number): { count: number; unit: IntervalUnit } {
  for (const unit of ['year', 'month', 'week'] as const) {
    if (days % INTERVAL_UNITS[unit] === 0) return { count: days / INTERVAL_UNITS[unit], unit }
  }
  return { count: days, unit: 'day' }
}

export const intervalDays = (count: number, unit: IntervalUnit) => count * INTERVAL_UNITS[unit]

/** Größte Anzahl einer Einheit, die noch in den längsten Abstand passt. */
export const maxCount = (unit: IntervalUnit) =>
  Math.floor(CHORE_MAX_INTERVAL / INTERVAL_UNITS[unit])

/** „jeden Tag“, „alle 2 Wochen“, „alle 3 Monate“. */
export function intervalText(t: TFunction, days: number): string {
  const { count, unit } = splitInterval(days)
  return t(`chores.every_${unit}`, { count })
}

/** Ab so vielen Tagen steht die Zeit in Wochen bzw. Monaten da („in etwa 3 Wochen“). */
const WEEKS_FROM = 14
const MONTHS_FROM = 60

/** Wann die Aufgabe dran ist: „in 4 Tagen“, „heute fällig“, „seit 3 Tagen fällig“. */
export function statusText(t: TFunction, chore: Chore): string {
  if (chore.done_today) return t('chores.status_done_today')
  const days = Math.abs(chore.days_left)
  const key = chore.days_left < 0 ? 'overdue' : 'in'
  if (chore.days_left === 0) return t('chores.status_today')
  if (days >= MONTHS_FROM) return t(`chores.status_${key}_months`, { count: Math.round(days / 30) })
  if (days >= WEEKS_FROM) return t(`chores.status_${key}_weeks`, { count: Math.round(days / 7) })
  return t(`chores.status_${key}_days`, { count: days })
}

/** Dringendste zuerst; bei gleichem Stand die mit dem kürzeren Abstand, dann nach Titel. */
export function byUrgency(a: Chore, b: Chore): number {
  return b.ratio - a.ratio || a.interval_days - b.interval_days || a.title.localeCompare(b.title)
}

/** Was am Display zählt: aktive Aufgaben, die heute noch nicht erledigt sind, nach Ampelstufe. */
export function groupByLevel(chores: Chore[]): Record<ChoreLevel, Chore[]> {
  const open = chores.filter((chore) => chore.active && !chore.done_today).sort(byUrgency)
  return Object.fromEntries(
    CHORE_LEVELS.map((level) => [level, open.filter((chore) => chore.level === level)]),
  ) as Record<ChoreLevel, Chore[]>
}

/** Farben der Ampel: Punkt bzw. Balken und die Schrift für den Stand. */
export const LEVEL_COLORS: Record<ChoreLevel, { fill: string; text: string }> = {
  due: { fill: 'bg-red-500', text: 'text-red-700' },
  soon: { fill: 'bg-amber-400', text: 'text-amber-700' },
  ok: { fill: 'bg-emerald-500', text: 'text-emerald-700' },
}
