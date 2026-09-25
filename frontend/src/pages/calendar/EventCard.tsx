import { useTranslation } from 'react-i18next'

import type { WeekEvent } from '../../api/calendar'
import { Avatar } from '../../components/Avatar'
import { FamilyAvatar } from '../../components/FamilyAvatar'
import { colorTokens } from '../../memberColors'
import { type Owners, isAllDayOnThisDay } from './owners'

/**
 * Termin in den Farben seiner Personen. Ganztägige Termine sind kräftig gefärbte Balken,
 * Termine mit Uhrzeit helle Karten mit Farbstreifen, Uhrzeit und Avataren.
 */
export function EventCard({
  event,
  owners,
  familyColor,
  timeZone,
  past,
}: {
  event: WeekEvent
  owners: Owners
  familyColor: string
  timeZone: string
  /** Schon vorbei: blasser, damit das Kommende auffällt. */
  past: boolean
}) {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language
  const colors = [
    ...owners.members.map((member) => member.color),
    ...(owners.family ? [familyColor] : []),
  ]
  const main = colorTokens(colors[0])
  const title = event.title ?? t('calendar.untitled')
  const names = [
    ...owners.members.map((member) => member.name),
    ...(owners.family ? [t('calendar.family')] : []),
  ]
  const avatars = (
    <span className="flex shrink-0 -space-x-2">
      {owners.members.map((member) => (
        <Avatar
          key={member.id}
          name={member.name}
          color={member.color}
          src={member.avatar_url}
          size="xs"
        />
      ))}
      {owners.family && <FamilyAvatar color={familyColor} size="xs" />}
    </span>
  )
  const people = (
    <span className="sr-only">{t('calendar.people', { names: names.join(', ') })}</span>
  )

  if (isAllDayOnThisDay(event)) {
    return (
      <li
        className={`flex items-center gap-2 rounded-2xl py-1.5 pr-1.5 pl-3 ${past ? 'opacity-50' : ''}`}
        style={{ backgroundColor: main.main, color: main.onMain }}
        data-testid="calendar-event"
      >
        <span className="min-w-0 flex-1 text-base leading-tight font-extrabold break-words">
          {title}
        </span>
        {people}
        {avatars}
      </li>
    )
  }

  const time = new Intl.DateTimeFormat(language, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  })
  const start = new Date(event.start)
  const end = new Date(event.end)
  const when = event.continues_before
    ? t('calendar.until', { time: time.format(end) })
    : event.continues_after
      ? t('calendar.from', { time: time.format(start) })
      : start.getTime() === end.getTime()
        ? time.format(start)
        : time.formatRange(start, end)

  return (
    <li
      className={`flex gap-2 overflow-hidden rounded-2xl bg-white shadow-sm ${past ? 'opacity-50' : ''}`}
      style={{ backgroundColor: main.soft }}
      data-testid="calendar-event"
    >
      {/* Farbstreifen: eine Farbe je Person. */}
      <span aria-hidden="true" className="flex w-2 shrink-0 flex-col">
        {colors.map((color, index) => (
          <span
            key={index}
            className="flex-1"
            style={{ backgroundColor: colorTokens(color).main }}
          />
        ))}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1 py-2 pr-2">
        <span className="text-base font-extrabold" style={{ color: main.strong }}>
          {when}
        </span>
        <span className="text-lg leading-tight font-bold break-words text-slate-800">{title}</span>
        {people}
        {avatars}
      </span>
    </li>
  )
}
