import { useMembers } from '../../api/members'
import { type TodayTask, useToday } from '../../api/today'

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

export function tasksFor(tasks: TodayTask[], memberId: number) {
  return tasks.filter((task) => task.member_ids.includes(memberId))
}
