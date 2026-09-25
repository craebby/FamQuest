/** ISO-Wochentage (1 = Montag … 7 = Sonntag) mit Locale-Formatierung über die Intl-API. */

export const WORKDAYS = [1, 2, 3, 4, 5]
export const WEEKEND = [6, 7]

interface WeekInfo {
  firstDay: number
}

/** Erster Tag der Woche laut Locale (de: Montag, en-US: Sonntag). */
export function firstDayOfWeek(language: string): number {
  try {
    const locale = new Intl.Locale(language) as Intl.Locale & {
      getWeekInfo?: () => WeekInfo
      weekInfo?: WeekInfo
    }
    return locale.getWeekInfo?.().firstDay ?? locale.weekInfo?.firstDay ?? 1
  } catch {
    return 1
  }
}

/** Alle sieben Wochentage in der Reihenfolge der Locale. */
export function weekdayOrder(language: string): number[] {
  const first = firstDayOfWeek(language)
  return Array.from({ length: 7 }, (_, offset) => ((first - 1 + offset) % 7) + 1)
}

export function weekdayName(language: string, weekday: number, width: 'short' | 'long') {
  // 1. Januar 2024 war ein Montag.
  const date = new Date(Date.UTC(2024, 0, weekday))
  return new Intl.DateTimeFormat(language, { weekday: width, timeZone: 'UTC' }).format(date)
}

export function sameDays(a: readonly number[], b: readonly number[]) {
  return a.length === b.length && [...a].sort().every((day, index) => day === [...b].sort()[index])
}

/** `YYYY-MM-DD` → lokal formatiertes Datum, z. B. „3. Okt. 2026“. */
export function formatDate(language: string, isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, day)),
  )
}

/** Heutiges Datum (`YYYY-MM-DD`) in der Zeitzone der Familie, nicht in UTC. */
export function todayIn(timeZone: string, now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(now)
}

/** `YYYY-MM-DD` → Wochentag und Datum, z. B. „Samstag, 3. Oktober“. */
export function formatLongDate(language: string, isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Intl.DateTimeFormat(language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}
