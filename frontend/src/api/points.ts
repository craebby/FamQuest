import { useInfiniteQuery } from '@tanstack/react-query'

import { api, apiGet } from './client'
import { useParentMutation } from './mutations'
import { TODAY_KEY } from './today'

// Muss zu POINT_KINDS im Backend passen (backend/app/schemas.py).
export type PointKind = 'task_completed' | 'task_undone' | 'manual'

export interface PointTransaction {
  id: number
  amount: number
  kind: PointKind
  /** Aufgabentitel zum Buchungszeitpunkt bzw. Begründung der Eltern. */
  reason: string | null
  /** Icon der Aufgabe, solange sie noch existiert. */
  task_icon: string | null
  task_date: string | null
  created_at: string
}

export interface PointHistory {
  total: number
  transactions: PointTransaction[]
  has_more: boolean
}

export interface PointBooking {
  /** Positiv = gutschreiben, negativ = abziehen. */
  amount: number
  reason: string
}

// Muss zu MANUAL_MAX_POINTS im Backend passen (backend/app/schemas.py).
export const MANUAL_MAX_POINTS = 1000

export const POINTS_KEY = ['points'] as const

/** Punktestand und Buchungen einer Person, neueste zuerst; ältere Seiten per `fetchNextPage`. */
export function usePointHistory(memberId: number) {
  return useInfiniteQuery({
    queryKey: [...POINTS_KEY, memberId],
    queryFn: ({ pageParam }) =>
      apiGet<PointHistory>(
        `/members/${memberId}/points${pageParam === null ? '' : `?before=${pageParam}`}`,
      ),
    initialPageParam: null as number | null,
    getNextPageParam: (page) => (page.has_more ? (page.transactions.at(-1)?.id ?? null) : null),
  })
}

export const bookPoints = (memberId: number, booking: PointBooking) =>
  api<PointHistory>('POST', `/members/${memberId}/points`, booking)

/** Manuelle Buchung; lädt danach Historie und Familienansicht neu. */
export function useBookPoints(memberId: number) {
  return useParentMutation(
    (booking: PointBooking) => bookPoints(memberId, booking),
    [POINTS_KEY, TODAY_KEY],
  )
}
