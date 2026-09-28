import type { TFunction } from 'i18next'

import type { Recurrence } from './api/tasks'
import { WEEKEND, WORKDAYS, formatDate, sameDays, weekdayName, weekdayOrder } from './weekdays'

/** Kurzbeschreibung einer Wiederholung, z. B. „Täglich“, „Mo, Mi, Fr“ oder „Am 3. Okt. 2026“. */
export function recurrenceSummary(t: TFunction, language: string, recurrence: Recurrence): string {
  switch (recurrence.kind) {
    case 'daily':
      return t('tasks.summary_daily')
    case 'weekly': {
      const days = recurrence.weekdays
      if (sameDays(days, WORKDAYS)) return t('tasks.summary_workdays')
      if (sameDays(days, WEEKEND)) return t('tasks.summary_weekend')
      if (days.length === 7) return t('tasks.summary_daily')
      const names = weekdayOrder(language)
        .filter((day) => days.includes(day))
        .map((day) => weekdayName(language, day, 'short'))
      return new Intl.ListFormat(language, { type: 'conjunction' }).format(names)
    }
    case 'once':
      return t('tasks.summary_once', { date: formatDate(language, recurrence.date) })
    case 'flexible':
      return flexibleSummary(t, recurrence.interval_days)
  }
}

/** Kurz für die Schnellwahl: „Jede Woche“, „Alle 3 Tage“, „Jeden Monat“. */
export function intervalLabel(t: TFunction, days: number): string {
  if (days % 30 === 0) return t('tasks.interval_months', { count: days / 30 })
  if (days % 7 === 0) return t('tasks.interval_weeks', { count: days / 7 })
  return t('tasks.interval_days_label', { count: days })
}

/** „Flexibel, etwa jede Woche“, „… alle 3 Tage“, „… jeden Monat“. */
export function flexibleSummary(t: TFunction, days: number): string {
  if (days % 30 === 0) return t('tasks.summary_flexible_months', { count: days / 30 })
  if (days % 7 === 0) return t('tasks.summary_flexible_weeks', { count: days / 7 })
  return t('tasks.summary_flexible_days', { count: days })
}
