import { useMembers } from '../../api/members'
import { sortForMember } from '../../api/tasks'
import { type TodayTask, isUpcoming, useToday } from '../../api/today'

/** Personen und heutige Aufgaben für Familien- und Personenansicht. */
export function useFamilyToday() {
  const members = useMembers()
  const today = useToday()
  return {
    members: members.data,
    today: today.data,
    isPending: members.isPending || today.isPending,
    error: members.error ?? today.error,
    refetch: () => Promise.all([members.refetch(), today.refetch()]),
  }
}

/** Heutige Aufgaben einer Person in ihrer Reihenfolge (siehe sortForMember). */
export function tasksFor(tasks: TodayTask[], memberId: number) {
  return sortForMember(
    tasks.filter((task) => task.member_ids.includes(memberId)),
    memberId,
  )
}

/**
 * Aufgaben, die zum Tagesfortschritt zählen: ohne flexible Aufgaben, die erst demnächst fällig
 * sind, und ohne freiwillige Extras.
 */
export function currentTasks(tasks: TodayTask[], memberId: number, date: string) {
  return tasks.filter((task) => !task.extra && !isUpcoming(task, memberId, date))
}
