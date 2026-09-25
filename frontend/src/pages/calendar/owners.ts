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

/** Farben der Personen eines Termins, die Familie zuletzt. */
export const ownerColors = (owners: Owners, familyColor: string) => [
  ...owners.members.map((member) => member.color),
  ...(owners.family ? [familyColor] : []),
]

/** Uhrzeit eines Termins an einem Tag: „10:00–11:00“, „ab 22:00“ oder „bis 02:00“. */
export function eventWhen(
  event: WeekEvent,
  language: string,
  timeZone: string,
  t: (key: string, options?: Record<string, string>) => string,
) {
  const time = new Intl.DateTimeFormat(language, { hour: 'numeric', minute: '2-digit', timeZone })
  const start = new Date(event.start)
  const end = new Date(event.end)
  if (event.continues_before) return t('calendar.until', { time: time.format(end) })
  if (event.continues_after) return t('calendar.from', { time: time.format(start) })
  return start.getTime() === end.getTime() ? time.format(start) : time.formatRange(start, end)
}
