import { type Member, childrenOf } from '../../api/members'
import { type Today, isDoneFor } from '../../api/today'
import { currentTasks, tasksFor } from '../family/useFamilyToday'

/** Heute selbst erledigte Aufgaben (Portionen) und ob alles erledigt ist, was heute zählt. */
export function feeding(today: Today, memberId: number) {
  const tasks = tasksFor(today.tasks, memberId)
  const food = tasks.filter((task) => task.done_member_ids.includes(memberId)).length
  const counting = currentTasks(tasks, memberId, today.date)
  const allDone = counting.length > 0 && counting.every((task) => isDoneFor(task, memberId))
  return { food, allDone }
}

/** Kinder mit Begleiter-Tier (nicht „nur Belohnungen“). */
export const companionChildren = (members: Member[]) =>
  childrenOf(members).filter((member) => member.companion_mode !== 'rewards')
