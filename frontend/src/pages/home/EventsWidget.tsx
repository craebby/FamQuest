import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import CalendarIcon from '~icons/fluent-emoji-flat/spiral-calendar'
import WarningIcon from '~icons/fluent-emoji-flat/warning'

import { type UpcomingEvent, useCalendarStatus, useCalendarUpcoming } from '../../api/calendar'
import { useMembers } from '../../api/members'
import { errorMessage } from '../../errors'
import { EventCard } from '../calendar/EventCard'
import { EventDialog } from '../calendar/EventDialog'
import { HolidayChip } from '../calendar/HolidayChip'
import { type Owners, ownersOf } from '../calendar/owners'
import { SetupHint, Widget } from './Widget'

/** So viele Termine zeigt die Startseite. */
export const UPCOMING_LIMIT = 5

function parseDate(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Die nächsten Termine: laufende und kommende, jeweils mit Tag („Heute“, „Morgen“, „Sa., 10.10.“). */
export function EventsWidget({ className }: { className?: string }) {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language
  const status = useCalendarStatus()
  const enabled = status.data?.enabled ?? false
  const upcoming = useCalendarUpcoming(UPCOMING_LIMIT, language)
  const members = useMembers().data ?? []
  const [open, setOpen] = useState<{ event: UpcomingEvent; owners: Owners } | null>(null)
  const data = upcoming.data

  const dayLabel = (day: string) => {
    if (!data || day === data.today) return t('calendar.today')
    const date = parseDate(day)
    if (date.getTime() - parseDate(data.today).getTime() === DAY_MS) return t('home.tomorrow')
    return new Intl.DateTimeFormat(language, {
      weekday: 'short',
      day: 'numeric',
      month: 'numeric',
      timeZone: 'UTC',
    }).format(date)
  }

  return (
    <Widget
      title={t('home.events')}
      icon={CalendarIcon}
      more={enabled ? { to: '/calendar', label: t('home.open_calendar') } : undefined}
      className={className}
    >
      {status.isPending || (enabled && upcoming.isPending) ? (
        <p role="status" className="text-lg text-slate-500">
          {t('common.loading')}
        </p>
      ) : !enabled ? (
        <SetupHint text={t('home.setup_calendar')} />
      ) : !data ? (
        <p className="text-lg text-slate-600">{errorMessage(t, upcoming.error)}</p>
      ) : (
        <>
          {data.problem && (
            <p className="flex items-center gap-2 rounded-2xl bg-amber-100 px-3 py-2 text-base font-semibold text-amber-900">
              <WarningIcon className="size-6 shrink-0" aria-hidden="true" />
              {t('calendar.problem')}
            </p>
          )}
          {data.holidays.length > 0 && (
            <ul className="flex flex-col gap-1">
              {data.holidays.map((holiday) => (
                <HolidayChip key={`${holiday.kind}-${holiday.name}`} {...holiday} />
              ))}
            </ul>
          )}
          {data.events.length === 0 ? (
            <p className="text-lg text-slate-500">{t('home.no_events')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.events.map((event) => {
                const owners = ownersOf(event, members)
                return (
                  <EventCard
                    key={`${event.key}-${event.day}`}
                    event={event}
                    owners={owners}
                    familyColor={data.family_color}
                    timeZone={data.timezone}
                    past={false}
                    dayLabel={dayLabel(event.day)}
                    onOpen={() => setOpen({ event, owners })}
                  />
                )
              })}
            </ul>
          )}
          {open && (
            <EventDialog
              event={open.event}
              owners={open.owners}
              familyColor={data.family_color}
              timeZone={data.timezone}
              onClose={() => setOpen(null)}
            />
          )}
        </>
      )}
    </Widget>
  )
}
