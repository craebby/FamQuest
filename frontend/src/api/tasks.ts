import { useQuery } from '@tanstack/react-query'

import type { MemberColor } from '../memberColors'
import { api, apiGet } from './client'
import { useParentMutation } from './mutations'

// Müssen zu TIMES_OF_DAY bzw. den Recurrence-Modellen im Backend passen (backend/app/schemas.py).
export const TIMES_OF_DAY = ['morning', 'midday', 'afternoon', 'evening'] as const
export type TimeOfDay = (typeof TIMES_OF_DAY)[number]
export const TASK_MAX_POINTS = 1000

/** Wochentage nach ISO: 1 = Montag … 7 = Sonntag. Datum als `YYYY-MM-DD`. */
export type Recurrence =
  { kind: 'daily' } | { kind: 'weekly'; weekdays: number[] } | { kind: 'once'; date: string }
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
  recurrence: Recurrence
  member_ids: number[]
}

export interface Task extends TaskData {
  id: number
}

export const TASKS_KEY = ['tasks'] as const

export function useTasks() {
  return useQuery({ queryKey: TASKS_KEY, queryFn: () => apiGet<Task[]>('/tasks') })
}

export const createTask = (data: TaskData) => api<Task>('POST', '/tasks', data)
export const updateTask = (id: number, data: TaskData) => api<Task>('PUT', `/tasks/${id}`, data)
export const deleteTask = (id: number) => api<void>('DELETE', `/tasks/${id}`)

export function taskData({ id: _id, ...data }: Task): TaskData {
  return data
}

export function useTasksMutation<TVariables, TResult>(
  request: (variables: TVariables) => Promise<TResult>,
) {
  return useParentMutation(request, [TASKS_KEY])
}
