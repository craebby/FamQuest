import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { MemberColor } from '../memberColors'
import { ApiError, api, apiGet } from './client'
import type { TimeOfDay } from './tasks'

export interface TodayTask {
  id: number
  title: string
  icon: string
  points: number
  time_of_day: TimeOfDay | null
  /** null = Farbe der jeweiligen Person */
  color: MemberColor | null
  member_ids: number[]
  /** Personen, die die Aufgabe heute schon erledigt haben. */
  done_member_ids: number[]
}

export interface MemberPoints {
  member_id: number
  /** Heute mit Aufgaben verdiente Punkte. */
  today: number
  /** Punktestand (Summe aller Buchungen). */
  total: number
  /** Seit Montag erledigte Aufgaben; Grundlage der fairen Verteilung unter Erwachsenen. */
  week_done: number
}

export interface Today {
  /** Heutiges Datum (`YYYY-MM-DD`) in der Zeitzone der Familie. */
  date: string
  /** Montag der laufenden Woche (`YYYY-MM-DD`). */
  week_start: string
  /** Aktueller Tagesabschnitt in der Zeitzone der Familie. */
  time_of_day: TimeOfDay
  tasks: TodayTask[]
  points: MemberPoints[]
}

export const TODAY_KEY = ['today'] as const
const SET_DONE_KEY = ['today', 'set-done'] as const
/** Regelmäßig neu laden, damit Tageswechsel und Änderungen im Elternbereich ankommen. */
export const TODAY_REFETCH_MS = 60 * 1000

export function useToday() {
  return useQuery({
    queryKey: TODAY_KEY,
    queryFn: () => apiGet<Today>('/today'),
    refetchInterval: TODAY_REFETCH_MS,
  })
}

export interface SetDoneVariables {
  date: string
  taskId: number
  memberId: number
  done: boolean
}

function setDone({ date, taskId, memberId, done }: SetDoneVariables) {
  const path = `/today/tasks/${taskId}/members/${memberId}?date=${encodeURIComponent(date)}`
  return api<void>(done ? 'PUT' : 'DELETE', path)
}

/** Setzt den Status und schätzt die Punkte; die Antwort des Servers ersetzt die Schätzung. */
function withDone(today: Today, { taskId, memberId, done }: SetDoneVariables): Today {
  const task = today.tasks.find((candidate) => candidate.id === taskId)
  if (!task || task.done_member_ids.includes(memberId) === done) return today
  const delta = done ? task.points : -task.points
  const before = pointsFor(today, memberId)
  const after = {
    ...before,
    today: before.today + delta,
    total: before.total + delta,
    week_done: before.week_done + (done ? 1 : -1),
  }
  return {
    ...today,
    tasks: today.tasks.map((candidate) => {
      if (candidate !== task) return candidate
      const others = task.done_member_ids.filter((id) => id !== memberId)
      return { ...task, done_member_ids: done ? [...others, memberId] : others }
    }),
    points: [...today.points.filter((entry) => entry.member_id !== memberId), after],
  }
}

export function pointsFor(today: Today, memberId: number): MemberPoints {
  return (
    today.points.find((entry) => entry.member_id === memberId) ?? {
      member_id: memberId,
      today: 0,
      total: 0,
      week_done: 0,
    }
  )
}

/**
 * Erledigt eine Aufgabe oder nimmt sie zurück; die Karte ändert sich sofort (optimistisch).
 * Anfragen derselben Karte laufen nacheinander (`scope`), damit ein schneller Doppel-Tipp
 * in der richtigen Reihenfolge beim Server ankommt.
 */
export function useSetDone(taskId: number, memberId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: SET_DONE_KEY,
    scope: { id: `today-${taskId}-${memberId}` },
    mutationFn: setDone,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: TODAY_KEY })
      queryClient.setQueryData<Today>(TODAY_KEY, (today) => today && withDone(today, variables))
    },
    onError: (_error, variables) => {
      queryClient.setQueryData<Today>(
        TODAY_KEY,
        (today) => today && withDone(today, { ...variables, done: !variables.done }),
      )
    },
    onSettled: (_data, error) => {
      // Erst neu laden, wenn keine weiteren Tipps unterwegs sind, sonst flackern Karten zurück.
      const dayChanged = error instanceof ApiError && error.code === 'completion.day_changed'
      if (dayChanged || queryClient.isMutating({ mutationKey: SET_DONE_KEY }) === 1) {
        return queryClient.invalidateQueries({ queryKey: TODAY_KEY })
      }
    },
  })
}
