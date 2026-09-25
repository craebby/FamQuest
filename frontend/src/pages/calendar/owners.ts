import type { WeekEvent } from '../../api/calendar'
import type { Member } from '../../api/members'

/** Wem ein Termin gehört: Personen in ihrer Reihenfolge, ggf. zusätzlich die Familie. */
export interface Owners {
  members: Member[]
  family: boolean
}

export function ownersOf(event: WeekEvent, members: Member[]): Owners {
  const found = event.member_ids
    .map((id) => members.find((member) => member.id === id))
    .filter((member): member is Member => member !== undefined)
  // Kalender einer inzwischen unbekannten Person: wie ein Familientermin zeigen.
  return { members: found, family: event.family || found.length === 0 }
}

/** Ganztägig oder über den ganzen Tag (mehrtägiger Termin mitten drin). */
export const isAllDayOnThisDay = (event: WeekEvent) =>
  event.all_day || (event.continues_before && event.continues_after)
