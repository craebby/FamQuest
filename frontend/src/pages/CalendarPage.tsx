import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import LeftIcon from '~icons/fluent-emoji-flat/left-arrow'
import RightIcon from '~icons/fluent-emoji-flat/right-arrow'
import CalendarIcon from '~icons/fluent-emoji-flat/spiral-calendar'
import WarningIcon from '~icons/fluent-emoji-flat/warning'

import { type CalendarWeek, useCalendarStatus, useCalendarWeek } from '../api/calendar'
import { type Member, useMembers } from '../api/members'
import { Avatar } from '../components/Avatar'
import { FamilyAvatar } from '../components/FamilyAvatar'
import { Alert, Button } from '../components/ui'
import { errorMessage } from '../errors'
import { EventCard } from './calendar/EventCard'
import { isAllDayOnThisDay, ownersOf } from './calendar/owners'

/** Wessen Termine gezeigt werden: alle, nur eine Person (mit Familie) oder nur die Familie. */
type Focus = number | 'family' | null

function parseDate(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

/** Kalender: eine Woche (Montag bis Sonntag), Termine in den Farben der Personen. */
export function CalendarPage() {
  const { t } = useTranslation()
  const [offset, setOffset] = useState(0)
  const [focus, setFocus] = useState<Focus>(null)
  const status = useCalendarStatus()
  const week = useCalendarWeek(offset)
  const members = useMembers()

  if (status.data && !status.data.enabled) return <NothingSelected />

  const data = week.data
  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-extrabold text-orange-600">
          {data ? <WeekTitle week={data} /> : t('calendar.title')}
        </h1>
        <div className="ml-auto flex gap-2">
          <Button
            variant="secondary"
            aria-label={t('calendar.previous_week')}
            title={t('calendar.previous_week')}
            onClick={() => setOffset(offset - 1)}
            className="px-4"
          >
            <LeftIcon className="size-8" aria-hidden="true" />
          </Button>
          {offset !== 0 && (
            <Button variant="secondary" onClick={() => setOffset(0)}>
              {t('calendar.this_week')}
            </Button>
          )}
          <Button
            variant="secondary"
            aria-label={t('calendar.next_week')}
            title={t('calendar.next_week')}
            onClick={() => setOffset(offset + 1)}
            className="px-4"
          >
            <RightIcon className="size-8" aria-hidden="true" />
          </Button>
        </div>
      </header>
      {data?.problem && (
        <p className="flex items-center gap-3 rounded-2xl bg-amber-100 px-4 py-3 text-lg font-semibold text-amber-900">
          <WarningIcon className="size-8 shrink-0" aria-hidden="true" />
          {t('calendar.problem')}
        </p>
      )}
      {week.isPending ? (
        <p role="status" className="text-xl text-slate-600">
          {t('common.loading')}
        </p>
      ) : !data ? (
        <div className="flex flex-col items-start gap-4">
          <Alert>{errorMessage(t, week.error)}</Alert>
          <Button onClick={() => void week.refetch()}>{t('actions.retry')}</Button>
        </div>
      ) : (
        <>
          {members.data && members.data.length > 0 && (
            <PersonFilter
              members={members.data}
              familyColor={data.family_color}
              focus={focus}
              onChange={setFocus}
            />
          )}
          <Days week={data} members={members.data ?? []} focus={focus} now={week.dataUpdatedAt} />
        </>
      )}
    </main>
  )
}

function WeekTitle({ week }: { week: CalendarWeek }) {
  const { i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language
  const first = parseDate(week.days[0].date)
  const last = parseDate(week.days[week.days.length - 1].date)
  const sameYear = first.getUTCFullYear() === parseDate(week.today).getUTCFullYear()
  const format = new Intl.DateTimeFormat(language, {
    day: 'numeric',
    month: 'long',
    ...(sameYear && last.getUTCFullYear() === first.getUTCFullYear() ? {} : { year: 'numeric' }),
    timeZone: 'UTC',
  })
  return <>{format.formatRange(first, last)}</>
}

/** Tippen auf einen Avatar zeigt nur dessen Termine (und die der Familie), nochmal: alle. */
function PersonFilter({
  members,
  familyColor,
  focus,
  onChange,
}: {
  members: Member[]
  familyColor: string
  focus: Focus
  onChange: (focus: Focus) => void
}) {
  const { t } = useTranslation()
  const option = (value: Focus, label: string, avatar: ReactNode) => {
    const pressed = focus === value
    return (
      <button
        key={String(value)}
        type="button"
        aria-pressed={pressed}
        aria-label={label}
        title={label}
        onClick={() => onChange(pressed ? null : value)}
        className={`shrink-0 rounded-full focus-visible:outline-4 focus-visible:outline-orange-400 ${focus === null || pressed ? '' : 'opacity-40'}`}
      >
        {avatar}
      </button>
    )
  }
  return (
    <div
      role="group"
      aria-label={t('calendar.filter')}
      className="-mx-1 flex gap-3 overflow-x-auto px-1 py-1"
    >
      {members.map((member) =>
        option(
          member.id,
          member.name,
          <Avatar name={member.name} color={member.color} src={member.avatar_url} size="sm" />,
        ),
      )}
      {option('family', t('calendar.family'), <FamilyAvatar color={familyColor} size="sm" />)}
    </div>
  )
}

function Days({
  week,
  members,
  focus,
  now,
}: {
  week: CalendarWeek
  members: Member[]
  focus: Focus
  /** Zeitpunkt des letzten Abrufs (jede Minute neu); früher endende Termine sind vorbei. */
  now: number
}) {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language
  const weekday = new Intl.DateTimeFormat(language, { weekday: 'short', timeZone: 'UTC' })
  const longDate = new Intl.DateTimeFormat(language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })

  return (
    // Großer Bildschirm: sieben Spalten nebeneinander; schmal: Tage untereinander.
    <div className="grid flex-1 grid-cols-1 gap-3 lg:grid-cols-7">
      {week.days.map((day) => {
        const date = parseDate(day.date)
        const isToday = day.date === week.today
        const isPast = day.date < week.today
        const events = day.events
          .map((event) => ({ event, owners: ownersOf(event, members) }))
          .filter(
            ({ owners }) =>
              focus === null ||
              (focus === 'family'
                ? owners.family
                : owners.family || owners.members.some((member) => member.id === focus)),
          )
        return (
          <section
            key={day.date}
            aria-label={longDate.format(date)}
            aria-current={isToday ? 'date' : undefined}
            className={`flex min-w-0 flex-col gap-2 rounded-3xl p-2 ${isToday ? 'bg-orange-100 ring-4 ring-orange-400' : 'bg-white/60'} ${isPast ? 'opacity-60' : ''}`}
          >
            <h2
              className={`flex items-baseline gap-2 rounded-2xl px-3 py-1 ${isToday ? 'bg-orange-500 text-white' : 'text-slate-700'}`}
            >
              <span className="text-lg font-bold">{weekday.format(date)}</span>
              <span className="text-3xl font-extrabold">{date.getUTCDate()}</span>
              {isToday && (
                <span className="ml-auto text-base font-bold">{t('calendar.today')}</span>
              )}
            </h2>
            {events.length === 0 ? (
              <p className="px-3 py-2 text-base text-slate-400">{t('calendar.no_events')}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {events.map(({ event, owners }) => (
                  <EventCard
                    key={event.key}
                    event={event}
                    owners={owners}
                    familyColor={week.family_color}
                    timeZone={week.timezone}
                    past={
                      isToday && !isAllDayOnThisDay(event) && new Date(event.end).getTime() < now
                    }
                  />
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}

function NothingSelected() {
  const { t } = useTranslation()
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-4 text-center">
      <CalendarIcon className="size-32" aria-hidden="true" />
      <h1 className="text-3xl font-extrabold text-slate-800">{t('calendar.nothing_selected')}</h1>
      <p className="max-w-xl text-xl text-slate-600">{t('calendar.nothing_selected_hint')}</p>
      <Link
        to="/parents"
        className="inline-flex min-h-14 items-center rounded-2xl bg-orange-500 px-6 py-3 text-lg font-bold text-white hover:bg-orange-600 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
      >
        {t('family.open_parents')}
      </Link>
    </main>
  )
}
