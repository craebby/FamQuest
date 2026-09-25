import type { Member } from './api/members'
import { type Today, pointsFor } from './api/today'

export interface CareSegment {
  member: Member
  /** Seit Montag erledigte Aufgaben. */
  done: number
  /** Anteil an allen von Erwachsenen erledigten Aufgaben; zusammen genau 100. */
  percent: number
}

/**
 * Faire Verteilung: Anteil jedes Erwachsenen an den diese Woche von Erwachsenen erledigten
 * Aufgaben. Mit weniger als zwei Erwachsenen gibt es nichts zu verteilen (null).
 */
export function careShares(members: Member[], today: Today): CareSegment[] | null {
  const adults = members.filter((member) => member.role === 'parent')
  if (adults.length < 2) return null
  const counts = adults.map((member) => pointsFor(today, member.id).week_done)
  const total = counts.reduce((sum, count) => sum + count, 0)
  if (total === 0) return adults.map((member) => ({ member, done: 0, percent: 0 }))

  // Größte Reste zuerst aufrunden, damit die Prozente zusammen 100 ergeben.
  const exact = counts.map((count) => (count / total) * 100)
  const percents = exact.map(Math.floor)
  const order = exact
    .map((value, index) => ({ index, rest: value - Math.floor(value) }))
    .sort((a, b) => b.rest - a.rest)
  for (let i = 0; i < 100 - percents.reduce((sum, value) => sum + value, 0); i++) {
    percents[order[i].index] += 1
  }
  return adults.map((member, index) => ({ member, done: counts[index], percent: percents[index] }))
}
