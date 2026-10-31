import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import CalendarIcon from '~icons/fluent-emoji-flat/spiral-calendar'
import ClockIcon from '~icons/fluent-emoji-flat/alarm-clock'
import CrossIcon from '~icons/fluent-emoji-flat/cross-mark'
import MemoIcon from '~icons/fluent-emoji-flat/memo'
import PencilIcon from '~icons/fluent-emoji-flat/pencil'
import PinIcon from '~icons/fluent-emoji-flat/round-pushpin'
import TrashIcon from '~icons/fluent-emoji-flat/wastebasket'

import { useMe } from '../../api/auth'
import { type WeekEvent, useDeleteEvent } from '../../api/calendar'
import { Avatar } from '../../components/Avatar'
import { FamilyAvatar } from '../../components/FamilyAvatar'
import { TaskIcon } from '../../components/TaskIcon'
import { Alert, Button } from '../../components/ui'
import { errorMessage } from '../../errors'
import { colorTokens } from '../../memberColors'
import { PinDialog } from '../home/HomeEditor'
import { ColorStripe } from './EventCard'
import { EventForm } from './EventForm'
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

/** Was nach dem Antippen von „Bearbeiten“ oder „Löschen“ folgt. */
type Action = 'edit' | 'delete'

/** Details eines Termins; bearbeitbare Termine lassen sich mit der Eltern-PIN ändern und löschen. */
export function EventDialog({
  event,
  owners,
  familyColor,
  timeZone,
  readOnly = false,
  onClose,
}: {
  event: WeekEvent
  owners: Owners
  familyColor: string
  timeZone: string
  /** Küchenansicht: Termine nur ansehen. */
  readOnly?: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { data: me } = useMe()
  const remove = useDeleteEvent()
  const [asked, setAsked] = useState<Action | null>(null)
  const [action, setAction] = useState<Action | null>(null)
  const dialog = useRef<HTMLDivElement>(null)
  const colors = ownerColors(owners, familyColor)
  const main = colorTokens(colors[0])
  const when = useWhen(event, timeZone)

  useEffect(() => {
    // Nur beim Öffnen: Rendert die Seite dahinter neu (Uhr, Abruf), verlöre sonst ein Textfeld
    // mitten im Tippen den Fokus.
    dialog.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === 'Escape' && !asked && action !== 'edit') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, asked, action])

  const start = (next: Action) => (me?.parent_unlocked ? setAction(next) : setAsked(next))

  if (asked) {
    return (
      <PinDialog
        label={t(asked === 'edit' ? 'calendar.edit_event' : 'calendar.delete_event')}
        onUnlocked={() => {
          setAction(asked)
          setAsked(null)
        }}
        onCancel={() => setAsked(null)}
      />
    )
  }
  if (action === 'edit') {
    return (
      <EventForm event={event} timeZone={timeZone} familyColor={familyColor} onClose={onClose} />
    )
  }

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
            {event.icon && <TaskIcon icon={event.icon} className="size-16" />}
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

          {event.editable && !readOnly && action !== 'delete' && (
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => start('edit')}>
                <PencilIcon className="size-6" aria-hidden="true" />
                {t('calendar.edit_event')}
              </Button>
              <Button variant="danger" onClick={() => start('delete')}>
                <TrashIcon className="size-6" aria-hidden="true" />
                {t('calendar.delete_event')}
              </Button>
            </div>
          )}
          {action === 'delete' && (
            <div className="flex flex-col gap-3 rounded-2xl bg-red-50 p-4">
              <p className="text-lg font-semibold text-red-800">
                {t(event.recurring ? 'calendar.delete_confirm_series' : 'calendar.delete_confirm')}
              </p>
              {remove.isError && <Alert>{errorMessage(t, remove.error)}</Alert>}
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="danger"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(event.key, { onSuccess: onClose })}
                >
                  {t('calendar.delete_event')}
                </Button>
                <Button variant="secondary" onClick={() => setAction(null)}>
                  {t('actions.cancel')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
