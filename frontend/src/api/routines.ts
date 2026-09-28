import { useQuery, useQueryClient } from '@tanstack/react-query'

import { api, apiGet } from './client'
import { useParentMutation } from './mutations'
import { TASK_WEEK_KEY } from './taskWeek'
import { TASKS_KEY, type TaskData, type TimeOfDay } from './tasks'
import { TODAY_KEY } from './today'

export interface RoutineStep {
  task_id: number
  /** Optional: steht in der Routine, bringt Punkte, zählt aber nicht zum Tagesfortschritt. */
  optional: boolean
}

/**
 * Routine eines Kindes: ein Tagesabschnitt an bestimmten Wochentagen, Schritte in Reihenfolge.
 * Mehrere Routinen desselben Kindes und Abschnitts sind Varianten (z. B. Mo–Fr und Sa–So);
 * ihre Wochentage überschneiden sich nie.
 */
export interface Routine {
  id: number
  member_id: number
  time_of_day: TimeOfDay
  /** ISO-Wochentage 1 (Montag) … 7 (Sonntag); leer = an keinem Tag. */
  weekdays: number[]
  steps: RoutineStep[]
}

export const ROUTINES_KEY = ['routines'] as const

export function useRoutines() {
  return useQuery({ queryKey: ROUTINES_KEY, queryFn: () => apiGet<Routine[]>('/routines') })
}

/** Änderungen an Routinen wirken auf Aufgaben (Zuordnung), heute und die Woche. */
function useRoutinesMutation<TVariables, TResult>(
  request: (variables: TVariables) => Promise<TResult>,
) {
  return useParentMutation(request, [ROUTINES_KEY, TASKS_KEY, TODAY_KEY, TASK_WEEK_KEY])
}

export interface NewRoutine {
  member_id: number
  time_of_day: TimeOfDay
  /** Diese Tage gehen an die neue Routine; andere Varianten geben sie ab. */
  weekdays: number[]
  /** Schritte einer bestehenden Routine übernehmen. */
  copy_from?: number
}

export function useCreateRoutine() {
  return useRoutinesMutation((routine: NewRoutine) => api<Routine>('POST', '/routines', routine))
}

export function useSetRoutineDays() {
  return useRoutinesMutation(({ id, weekdays }: { id: number; weekdays: number[] }) =>
    api<Routine[]>('PUT', `/routines/${id}/days`, { weekdays }),
  )
}

/** Schritte in neuer Reihenfolge bzw. mit geändertem „optional“; sofort sichtbar. */
export function useSetRoutineSteps() {
  const queryClient = useQueryClient()
  const mutation = useRoutinesMutation(({ id, steps }: { id: number; steps: RoutineStep[] }) =>
    api<Routine>('PUT', `/routines/${id}/steps`, { steps }),
  )
  return {
    ...mutation,
    mutate: (variables: { id: number; steps: RoutineStep[] }) => {
      queryClient.setQueryData<Routine[]>(ROUTINES_KEY, (routines) =>
        routines?.map((routine) =>
          routine.id === variables.id ? { ...routine, steps: variables.steps } : routine,
        ),
      )
      mutation.mutate(variables)
    },
  }
}

export type NewStep = { optional?: boolean } & (
  { task_id: number; task?: never } | { task: TaskData; task_id?: never }
)

/** Neuer Schritt am Ende: eine vorhandene Aufgabe oder eine neue. */
export function useAddRoutineStep() {
  return useRoutinesMutation(({ id, step }: { id: number; step: NewStep }) =>
    api<Routine>('POST', `/routines/${id}/steps`, step),
  )
}

export function useDeleteRoutine() {
  return useRoutinesMutation((id: number) => api<void>('DELETE', `/routines/${id}`))
}
