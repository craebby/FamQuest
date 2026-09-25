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
  }
}
