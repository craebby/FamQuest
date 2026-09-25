import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { MemberColor } from '../memberColors'
import { ApiError, api, apiGet } from './client'
import type { MemberPosition, TimeOfDay } from './tasks'

export interface TodayTask {
  id: number
  title: string
  icon: string
  points: number
  time_of_day: TimeOfDay | null
  /** null = Farbe der jeweiligen Person */
  color: MemberColor | null
  member_ids: number[]
  needs_approval: boolean
  /** „Einer für alle“: erledigt für alle, sobald jemand in `done_member_ids` steht. */
  shared: boolean
  /** Extra-Aufgabe: freiwillig, eigener Block, zählt nicht zum Tagesfortschritt. */
  extra: boolean
  /** Platz in der Reihenfolge jeder Person. */
  positions: MemberPosition[]
  /** Nur bei flexiblen Aufgaben: Fälligkeit (`YYYY-MM-DD`) je Person. */
  due_dates: { member_id: number; due_date: string }[]
  /** Personen, die die Aufgabe heute schon erledigt haben (auch ungeprüft). */
  done_member_ids: number[]
  /** Davon: Erledigungen, die noch auf die Kontrolle der Eltern warten. */
  pending_member_ids: number[]
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
  /** Erledigungen aller Tage, die auf die Kontrolle der Eltern warten. */
  pending_approvals: number
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
  const by = task ? doneBy(task, memberId) : null
  if (!task || (by !== null) === done) return today
  // Wessen Erledigung sich ändert: beim Zurücknehmen von „Einer für alle“ die der Person,
  // die sie erledigt hatte.
  const target = done ? memberId : (by ?? memberId)
  // Ungeprüfte Erledigungen bringen noch keine Punkte und zählen noch nicht für die Woche.
  const wasPending = task.pending_member_ids.includes(target)
  const counts = done ? !task.needs_approval : !wasPending
  const delta = counts ? (done ? task.points : -task.points) : 0
  const before = pointsFor(today, target)
  const after = {
    ...before,
    today: before.today + delta,
    total: before.total + delta,
    week_done: before.week_done + (counts ? (done ? 1 : -1) : 0),
  }
  const pendingNow = done && task.needs_approval
  return {
    ...today,
    tasks: today.tasks.map((candidate) => {
      if (candidate !== task) return candidate
      const others = task.done_member_ids.filter((id) => id !== target)
      const otherPending = task.pending_member_ids.filter((id) => id !== target)
      return {
        ...task,
        done_member_ids: done ? [...others, target] : others,
        pending_member_ids: pendingNow ? [...otherPending, target] : otherPending,
      }
    }),
    points: [...today.points.filter((entry) => entry.member_id !== target), after],
    pending_approvals: today.pending_approvals + (pendingNow ? 1 : wasPending && !done ? -1 : 0),
  }
}

/**
 * Wer die Aufgabe heute für diese Person erledigt hat: die Person selbst oder, bei
 * „Einer für alle“, jemand anderes. null = offen.
 */
export function doneBy(task: TodayTask, memberId: number): number | null {
  if (task.done_member_ids.includes(memberId)) return memberId
  return task.shared ? (task.done_member_ids[0] ?? null) : null
}

export const isDoneFor = (task: TodayTask, memberId: number) => doneBy(task, memberId) !== null

export function isPendingFor(task: TodayTask, memberId: number) {
  const by = doneBy(task, memberId)
  return by !== null && task.pending_member_ids.includes(by)
}

const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86_400_000

/**
 * Flexible Aufgaben: Tage bis zur Fälligkeit (negativ = überfällig, 0 = heute fällig).
 * null bei anderen Aufgaben oder wenn sie heute schon erledigt ist.
 */
export function daysUntilDue(task: TodayTask, memberId: number, date: string): number | null {
  const due = task.due_dates.find((entry) => entry.member_id === memberId)
  if (!due || isDoneFor(task, memberId)) return null
  return dayNumber(due.due_date) - dayNumber(date)
}

/** Noch nicht fällig: steht unter „Demnächst“ und zählt nicht zum Tagesfortschritt. */
export const isUpcoming = (task: TodayTask, memberId: number, date: string) =>
  (daysUntilDue(task, memberId, date) ?? 0) > 0

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
