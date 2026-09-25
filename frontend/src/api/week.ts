import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { apiGet } from './client'

export interface WeekDay {
  /** `YYYY-MM-DD` */
  date: string
  planned: number
  done: number
}

export interface Week {
  /** Montag der Woche (`YYYY-MM-DD`). */
  start: string
  today: string
  members: { member_id: number; days: WeekDay[] }[]
}

export const WEEK_KEY = ['week'] as const

/** Wochenübersicht; ohne `start` die laufende Woche. */
export function useWeek(start: string | null) {
  return useQuery({
    queryKey: [...WEEK_KEY, start],
    queryFn: () => apiGet<Week>(start ? `/week?start=${start}` : '/week'),
    placeholderData: keepPreviousData,
  })
}
