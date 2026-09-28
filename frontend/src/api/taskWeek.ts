import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { MemberColor } from '../memberColors'
import { apiGet } from './client'
import { TASK_BLOCKS, type TimeOfDay, blockOf } from './tasks'

export interface WeekTask {
  id: number
  title: string
  icon: string
  points: number
  time_of_day: TimeOfDay | null
  color: MemberColor | null
  extra: boolean
}

export interface WeekEntry {
  task_id: number
  member_id: number
  /** pending: erledigt, wartet auf Kontrolle; open: (noch) nicht erledigt. */
  status: 'done' | 'pending' | 'open'
  /** Wer es erledigt hat; bei „Einer für alle“ auch eine andere Person. */
  done_by: number | null
  /** Platz in der Reihenfolge dieser Person an diesem Tag. */
  position: number
  /** Optionaler Routinenschritt: zählt nicht zum Tagesfortschritt. */
  optional: boolean
}

export interface TaskWeek {
  start: string
  today: string
  tasks: WeekTask[]
  days: { date: string; entries: WeekEntry[] }[]
}

/**
 * Fortschritt einer Person an einem Tag. Wie auf der Startseite zählen Extras und Aufgaben, die
 * jemand anderes für alle erledigt hat, nicht mit.
 */
export function dayProgress(
  entries: WeekEntry[],
  tasks: Map<number, WeekTask>,
  memberId: number,
): { done: number; total: number } {
  const counted = entries.filter(
    (entry) =>
      entry.member_id === memberId &&
      tasks.get(entry.task_id)?.extra === false &&
      !entry.optional &&
      (entry.done_by === null || entry.done_by === memberId),
  )
  return {
    done: counted.filter((entry) => entry.done_by === memberId).length,
    total: counted.length,
  }
}

/** Einträge einer Person an einem Tag in ihrer Reihenfolge: Blöcke nacheinander, darin nach Platz. */
export function sortEntries(entries: WeekEntry[], tasks: Map<number, WeekTask>): WeekEntry[] {
  const block = (entry: WeekEntry) => {
    const task = tasks.get(entry.task_id)
    return task ? TASK_BLOCKS.indexOf(blockOf(task)) : TASK_BLOCKS.length
  }
  return [...entries].sort(
    (a, b) => block(a) - block(b) || a.position - b.position || a.task_id - b.task_id,
  )
}

export const TASK_WEEK_KEY = ['task-week'] as const

/** Aufgaben einer Woche; `offset` 0 = aktuelle Woche. Aktualisiert sich jede Minute. */
export function useTaskWeek(offset: number) {
  return useQuery({
    queryKey: [...TASK_WEEK_KEY, offset],
    queryFn: () => apiGet<TaskWeek>(`/tasks/week?offset=${offset}`),
    refetchInterval: 60 * 1000,
    placeholderData: keepPreviousData,
  })
}
