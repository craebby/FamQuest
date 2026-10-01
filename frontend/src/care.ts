import type { ChorePlan } from './api/chores'
import type { Member } from './api/members'

export interface CareSegment {
  member: Member
  /** Erledigungen im Putzplan, zu denen „Wer war's?“ diese Person nennt. */
  done: number
  /** Anteil an allen so zugeordneten Erledigungen; zusammen genau 100. */
  percent: number
}

/**
 * Faire Verteilung im Haushalt: wer in den letzten Tagen wie viel vom Putzplan erledigt hat.
 * Erwachsene stehen immer dabei, Kinder nur, wenn sie mitgeholfen haben. Solange niemand etwas
 * angetippt hat oder nur eine Person dabei wäre, gibt es nichts zu verteilen (null).
 */
export function careShares(members: Member[], shares: ChorePlan['shares']): CareSegment[] | null {
  const count = (member: Member) =>
    shares.find((share) => share.member_id === member.id)?.count ?? 0
  const people = members.filter((member) => member.role === 'parent' || count(member) > 0)
  const counts = people.map(count)
  const total = counts.reduce((sum, value) => sum + value, 0)
  if (people.length < 2 || total === 0) return null

  // Größte Reste zuerst aufrunden, damit die Prozente zusammen 100 ergeben.
  const exact = counts.map((value) => (value / total) * 100)
  const percents = exact.map(Math.floor)
  const order = exact
    .map((value, index) => ({ index, rest: value - Math.floor(value) }))
    .sort((a, b) => b.rest - a.rest)
  for (let i = 0; i < 100 - percents.reduce((sum, value) => sum + value, 0); i++) {
    percents[order[i].index] += 1
  }
  return people.map((member, index) => ({ member, done: counts[index], percent: percents[index] }))
}
