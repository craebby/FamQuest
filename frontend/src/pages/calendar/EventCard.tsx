import { useTranslation } from 'react-i18next'

import type { WeekEvent } from '../../api/calendar'
import { Avatar } from '../../components/Avatar'
import { FamilyAvatar } from '../../components/FamilyAvatar'
import { TaskIcon } from '../../components/TaskIcon'
import { colorTokens } from '../../memberColors'
import { type Owners, eventWhen, isAllDayOnThisDay, ownerColors } from './owners'

/** Avatare der Personen (und ggf. der Familie), leicht überlappend. */
export function OwnerAvatars({ owners, familyColor }: { owners: Owners; familyColor: string }) {
  return (
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
}

/** Farbstreifen am Rand: eine Farbe je Person. */
export function ColorStripe({
  colors,
  className = 'w-2',
}: {
  colors: string[]
  className?: string
}) {
  return (
    <span aria-hidden="true" className={`flex shrink-0 flex-col self-stretch ${className}`}>
      {colors.map((color, index) => (
        <span key={index} className="flex-1" style={{ backgroundColor: colorTokens(color).main }} />
      ))}
    </span>
  )
}

/**
 * Termin in den Farben seiner Personen: helle Karte mit Farbstreifen, oben Uhrzeit und Avatare,
 * darunter Titel (ggf. mit Symbol). Ganztägige Termine stehen in einer Zeile, vorbei gegangene
 * Termine schrumpfen auf Uhrzeit und Titel. Antippen öffnet die Details.
 */
export function EventCard({
  event,
  owners,
  familyColor,
  timeZone,
  past,
  onOpen,
}: {
  event: WeekEvent
  owners: Owners
  familyColor: string
  timeZone: string
  /** Schon vorbei: blass und klein, damit das Kommende auffällt. */
  past: boolean
  onOpen: () => void
}) {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language
  const colors = ownerColors(owners, familyColor)
  const main = colorTokens(colors[0])
  const title = event.title ?? t('calendar.untitled')
  const names = [
    ...owners.members.map((member) => member.name),
    ...(owners.family ? [t('calendar.family')] : []),
  ]
  const allDay = isAllDayOnThisDay(event)
  const people = (
    <span className="sr-only">{t('calendar.people', { names: names.join(', ') })}</span>
  )
  const titleText = (
    <span className="min-w-0 flex-1 text-lg leading-tight font-bold break-words hyphens-auto text-slate-800">
      {title}
    </span>
  )
  const icon = event.icon && <TaskIcon icon={event.icon} className="size-8 shrink-0" />

  let body
  if (allDay) {
    // Ohne eigene Zeile „Ganztägig“: Farbe und Avatar zeigen, wem der Tag gehört.
    body = (
      <span className="flex items-center gap-2">
        <span className="sr-only">{t('calendar.all_day')}: </span>
        {icon}
        {titleText}
        {people}
        <OwnerAvatars owners={owners} familyColor={familyColor} />
      </span>
    )
  } else if (past) {
    body = (
      <span className="flex items-baseline gap-2">
        <span className="shrink-0 text-base font-extrabold" style={{ color: main.strong }}>
          {eventWhen(event, language, timeZone, t)}
        </span>
        <span className="min-w-0 truncate text-base font-bold text-slate-800">{title}</span>
        {people}
      </span>
    )
  } else {
    body = (
      <>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="flex-1 text-base font-extrabold" style={{ color: main.strong }}>
            {eventWhen(event, language, timeZone, t)}
          </span>
          {people}
          <OwnerAvatars owners={owners} familyColor={familyColor} />
        </span>
        <span className="flex items-center gap-2">
          {icon}
          {titleText}
        </span>
      </>
    )
  }

  return (
    <li className={past ? 'opacity-50' : ''} data-testid="calendar-event">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full gap-2 overflow-hidden rounded-2xl text-left shadow-sm focus-visible:outline-4 focus-visible:outline-orange-400 active:scale-[0.98] motion-reduce:active:scale-100"
        style={{ backgroundColor: main.soft }}
      >
        <ColorStripe colors={colors} />
        <span className="flex min-w-0 flex-1 flex-col gap-1 py-1.5 pr-2">{body}</span>
      </button>
    </li>
  )
}
