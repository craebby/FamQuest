import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import CalendarIcon from '~icons/fluent-emoji-flat/spiral-calendar'
import ClockIcon from '~icons/fluent-emoji-flat/alarm-clock'
import CrossIcon from '~icons/fluent-emoji-flat/cross-mark'
import MemoIcon from '~icons/fluent-emoji-flat/memo'
import PinIcon from '~icons/fluent-emoji-flat/round-pushpin'

import type { WeekEvent } from '../../api/calendar'
import { Avatar } from '../../components/Avatar'
import { FamilyAvatar } from '../../components/FamilyAvatar'
import { colorTokens } from '../../memberColors'
import { ColorStripe } from './EventCard'
import { type Owners, ownerColors } from './owners'

function parseDate(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

/** Wann: Datum und Uhrzeit, mehrtägige Termine als Zeitraum. */
function useWhen(event: WeekEvent, timeZone: string) {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language
  if (event.all_day) {
    const format = new Intl.DateTimeFormat(language, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    })
    const start = parseDate(event.start)
    // Das Ende ist exklusiv: letzter Tag = Ende minus ein Tag.
    const last = new Date(parseDate(event.end).getTime() - 24 * 60 * 60 * 1000)
    return last.getTime() === start.getTime()
      ? `${format.format(start)} · ${t('calendar.all_day')}`
      : format.formatRange(start, last)
  }
  const format = new Intl.DateTimeFormat(language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  })
  const start = new Date(event.start)
  const end = new Date(event.end)
  return start.getTime() === end.getTime() ? format.format(start) : format.formatRange(start, end)
}

/** Details eines Termins: nur lesen, bearbeitet wird im Google Kalender. */
export function EventDialog({
  event,
  owners,
  familyColor,
  timeZone,
  onClose,
}: {
  event: WeekEvent
  owners: Owners
  familyColor: string
  timeZone: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const dialog = useRef<HTMLDivElement>(null)
  const colors = ownerColors(owners, familyColor)
  const main = colorTokens(colors[0])
  const when = useWhen(event, timeZone)

  useEffect(() => {
    dialog.current?.focus()
    const onKey = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4"
      onClick={onClose}
    >
      <div
        ref={dialog}
        tabIndex={-1}
        onClick={(clickEvent) => clickEvent.stopPropagation()}
        className="flex max-h-full w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-xl outline-none"
      >
        <ColorStripe colors={colors} className="w-4" />
        <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
          <div className="flex items-start gap-3">
            <h2
              id="event-title"
              className="min-w-0 flex-1 text-3xl leading-tight font-extrabold break-words text-slate-800"
            >
              {event.title ?? t('calendar.untitled')}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('calendar.details_close')}
              title={t('calendar.details_close')}
              className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-slate-100 hover:bg-slate-200 focus-visible:outline-4 focus-visible:outline-orange-400"
            >
              <CrossIcon className="size-8" aria-hidden="true" />
            </button>
          </div>

          <p className="flex items-center gap-3 text-xl font-bold" style={{ color: main.strong }}>
            <ClockIcon className="size-8 shrink-0" aria-hidden="true" />
            {when}
          </p>

          <ul className="flex flex-wrap gap-2">
            {owners.members.map((member) => (
              <li
                key={member.id}
                className="flex items-center gap-2 rounded-full bg-slate-50 py-1 pr-4 pl-1 text-lg font-bold text-slate-700"
              >
                <Avatar name={member.name} color={member.color} src={member.avatar_url} size="xs" />
                {member.name}
              </li>
            ))}
            {owners.family && (
              <li className="flex items-center gap-2 rounded-full bg-slate-50 py-1 pr-4 pl-1 text-lg font-bold text-slate-700">
                <FamilyAvatar color={familyColor} size="xs" />
                {t('calendar.family')}
              </li>
            )}
          </ul>

          {event.location && (
            <div className="flex items-start gap-3 text-lg text-slate-700">
              <PinIcon className="size-8 shrink-0" aria-hidden="true" />
              <p>
                <span className="sr-only">{t('calendar.location')}: </span>
                {event.location}
              </p>
            </div>
          )}
          {event.description && (
            <div className="flex items-start gap-3 text-lg text-slate-700">
              <MemoIcon className="size-8 shrink-0" aria-hidden="true" />
              <p className="min-w-0 break-words whitespace-pre-line">
                <span className="sr-only">{t('calendar.description')}: </span>
                {event.description}
              </p>
            </div>
          )}
          {event.calendars.length > 0 && (
            <p className="flex items-center gap-3 text-base text-slate-500">
              <CalendarIcon className="size-6 shrink-0" aria-hidden="true" />
              {t('calendar.from_calendar', {
                count: event.calendars.length,
                names: event.calendars.join(', '),
              })}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
