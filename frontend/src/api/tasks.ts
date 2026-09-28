import { useQuery } from '@tanstack/react-query'

import type { MemberColor } from '../memberColors'
import { api, apiGet } from './client'
import { useParentMutation } from './mutations'
import { TODAY_KEY } from './today'

// Müssen zu TIMES_OF_DAY bzw. den Recurrence-Modellen im Backend passen (backend/app/schemas.py).
export const TIMES_OF_DAY = ['morning', 'midday', 'afternoon', 'evening'] as const
export type TimeOfDay = (typeof TIMES_OF_DAY)[number]
export const TASK_MAX_POINTS = 1000
export const MAX_INTERVAL_DAYS = 365

/** Wochentage nach ISO: 1 = Montag … 7 = Sonntag. Datum als `YYYY-MM-DD`. */
export type Recurrence =
  | { kind: 'daily' }
  | { kind: 'weekly'; weekdays: number[] }
  | { kind: 'once'; date: string }
  /** Ohne festen Tag: fällig ab `date`, danach `interval_days` nach der letzten Erledigung. */
  | { kind: 'flexible'; interval_days: number; date: string }
export type RecurrenceKind = Recurrence['kind']

export interface TaskData {
  title: string
  icon: string
  description: string
  points: number
  time_of_day: TimeOfDay | null
  /** null = Farbe der jeweiligen Person */
  color: MemberColor | null
  active: boolean
  /** Punkte erst nach Kontrolle durch die Eltern. */
  needs_approval: boolean
  /** „Einer für alle“: eine Erledigung gilt für alle zugeordneten Personen. */
  shared: boolean
  /** Extra-Aufgabe: freiwillig, außerhalb der Routinen, zählt nicht zum Tagesfortschritt. */
  extra: boolean
  recurrence: Recurrence
  member_ids: number[]
}

/** Platz einer Aufgabe in der Reihenfolge einer Person (kleiner = früher). */
export interface MemberPosition {
  member_id: number
  position: number
  /** Optionaler Routinenschritt: Punkte ja, Tagesfortschritt nein. */
  optional?: boolean
}

export interface Task extends TaskData {
  id: number
  positions: MemberPosition[]
  /** Personen, für die die Aufgabe Schritt einer Routine ist. */
  routine_member_ids: number[]
}

/** Block einer Aufgabe: Routine eines Tagesabschnitts, „Jederzeit“ (null) oder Extra. */
export type TaskBlock = TimeOfDay | null | 'extra'
export const TASK_BLOCKS: readonly TaskBlock[] = [...TIMES_OF_DAY, null, 'extra']

interface Orderable {
  id: number
  time_of_day: TimeOfDay | null
  extra: boolean
  positions: MemberPosition[]
}

export const blockOf = (task: { extra: boolean; time_of_day: TimeOfDay | null }): TaskBlock =>
  task.extra ? 'extra' : task.time_of_day

/**
 * Aufgaben einer Person in ihrer Reihenfolge am Display: Blöcke nacheinander (Tagesabschnitte,
 * „Jederzeit“, Extras), innerhalb eines Blocks in der von den Eltern festgelegten Abfolge.
 */
export function sortForMember<T extends Orderable>(tasks: T[], memberId: number): T[] {
  const block = (task: T) => TASK_BLOCKS.indexOf(blockOf(task))
  return [...tasks].sort(
    (a, b) =>
      block(a) - block(b) || positionFor(a, memberId) - positionFor(b, memberId) || a.id - b.id,
  )
}

/** Optionaler Routinenschritt für diese Person (zählt nicht zum Tagesfortschritt)? */
export function isOptionalFor(task: { positions: MemberPosition[] }, memberId: number) {
  return task.positions.find((entry) => entry.member_id === memberId)?.optional === true
}

/** Platz in der Reihenfolge dieser Person; ohne Eintrag ans Ende. */
export function positionFor(task: { positions: MemberPosition[] }, memberId: number) {
  return (
    task.positions.find((entry) => entry.member_id === memberId)?.position ??
    Number.MAX_SAFE_INTEGER
  )
}

export const TASKS_KEY = ['tasks'] as const

export function useTasks() {
  return useQuery({ queryKey: TASKS_KEY, queryFn: () => apiGet<Task[]>('/tasks') })
}

export const createTask = (data: TaskData) => api<Task>('POST', '/tasks', data)
export const updateTask = (id: number, data: TaskData) => api<Task>('PUT', `/tasks/${id}`, data)
export const deleteTask = (id: number) => api<void>('DELETE', `/tasks/${id}`)

export function taskData({
  id: _id,
  positions: _positions,
  routine_member_ids: _routines,
  ...data
}: Task): TaskData {
  return data
}

export function useTasksMutation<TVariables, TResult>(
  request: (variables: TVariables) => Promise<TResult>,
) {
  return useParentMutation(request, [TASKS_KEY, TODAY_KEY])
}
