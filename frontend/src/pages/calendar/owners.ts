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

/**
 * Uhrzeit eines Termins an einem Tag: „10:00–11:00“, „ab 22:00“ oder „bis 02:00“. Ohne „Uhr“
 * hinter der Spanne (spart Platz); mit AM/PM bleibt die übliche Spanne („4:30 – 6:30 PM“).
 */
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
  if (start.getTime() === end.getTime()) return time.format(start)
  const twelveHour = time.formatToParts(start).some((part) => part.type === 'dayPeriod')
  return twelveHour ? time.formatRange(start, end) : `${time.format(start)}–${time.format(end)}`
}

function parseDate(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Tag eines kommenden Termins: „Heute“, „Morgen“ oder z. B. „Sa., 10.10.“. */
export function upcomingDayLabel(
  day: string,
  today: string,
  language: string,
  t: (key: string) => string,
) {
  if (day === today) return t('calendar.today')
  const date = parseDate(day)
  if (date.getTime() - parseDate(today).getTime() === DAY_MS) return t('home.tomorrow')
  return new Intl.DateTimeFormat(language, {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}
