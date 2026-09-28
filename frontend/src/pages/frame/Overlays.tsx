import { useTranslation } from 'react-i18next'

import { useMe } from '../../api/auth'
import { useCalendarUpcoming } from '../../api/calendar'
import type { FrameSettings } from '../../api/frame'
import type { Member } from '../../api/members'
import { doneBy } from '../../api/today'
import { useWeather } from '../../api/weather'
import { Avatar } from '../../components/Avatar'
import { TaskIcon } from '../../components/TaskIcon'
import { WeatherIcon } from '../../components/WeatherIcon'
import { useNow } from '../../useNow'
import { weatherKind } from '../../weatherKinds'
import { OwnerAvatars } from '../calendar/EventCard'
import { eventWhen, isAllDayOnThisDay, ownersOf, upcomingDayLabel } from '../calendar/owners'
import { currentTasks, tasksFor, useFamilyToday } from '../family/useFamilyToday'

/** So viele offene Aufgaben zeigt der Rahmen je Person als Symbol, der Rest als „+n“. */
export const TASKS_PER_MEMBER = 4

/** Weiße Schrift mit Schatten, damit sie auf hellen und dunklen Fotos lesbar bleibt. */
const SHADOW = 'drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]'

/**
 * Einblendungen über den Fotos: unten links Uhr, Datum und nächster Termin, rechts offene
 * Aufgaben und Wetter. Sie fangen keine Tipps ab; ein Tipp beendet den Bilderrahmen wie sonst.
 */
export function Overlays({ settings }: { settings: FrameSettings }) {
  const { show_clock, show_weather, show_event, show_tasks } = settings
  if (!show_clock && !show_weather && !show_event && !show_tasks) return null
  return (
    <div
      data-testid="frame-overlays"
      className="pointer-events-none fixed inset-x-0 bottom-0 flex items-end justify-between gap-6 bg-gradient-to-t from-black/60 via-black/25 to-transparent px-6 pt-24 pb-6 text-white sm:px-10 sm:pb-8"
    >
      <div className="flex min-w-0 flex-col gap-3">
        {show_clock && <Clock />}
        {show_event && <NextEvent />}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-3">
        {show_tasks && <OpenTasks />}
        {show_weather && <Weather />}
      </div>
    </div>
  )
}

function Clock() {
  const { t, i18n } = useTranslation()
  const timeZone = useMe().data?.family.timezone
  const now = useNow()
  const language = i18n.resolvedLanguage ?? i18n.language
  const time = new Intl.DateTimeFormat(language, { hour: 'numeric', minute: '2-digit', timeZone })
  const date = new Intl.DateTimeFormat(language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone,
  })
  return (
    <div className={SHADOW}>
      <p className="text-7xl leading-none font-extrabold tabular-nums sm:text-8xl">
        <span className="sr-only">{t('home.time')}: </span>
        <time>{time.format(now)}</time>
      </p>
      <p className="mt-1 text-2xl font-bold sm:text-3xl">{date.format(now)}</p>
    </div>
  )
}

function NextEvent() {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language
  const upcoming = useCalendarUpcoming(1, language).data
  const { members } = useFamilyToday()
  const event = upcoming?.events[0]
  if (!upcoming || !event) return null
  const owners = ownersOf(event, members ?? [])
  const when = isAllDayOnThisDay(event)
    ? t('calendar.all_day')
    : eventWhen(event, language, upcoming.timezone, t)
  return (
    <p className="flex max-w-2xl items-center gap-3 self-start rounded-2xl bg-black/35 px-4 py-2 text-xl font-bold backdrop-blur-sm">
      <OwnerAvatars owners={owners} familyColor={upcoming.family_color} />
      <span className="shrink-0">
        {upcomingDayLabel(event.day, upcoming.today, language, t)}, {when}
      </span>
      {event.icon && <TaskIcon icon={event.icon} className="size-10" />}
      <span className="truncate font-extrabold">{event.title}</span>
    </p>
  )
}

function Weather() {
  const { t } = useTranslation()
  const current = useWeather().data?.current
  if (!current) return null
  return (
    <p className={`flex items-center gap-3 ${SHADOW}`}>
      <WeatherIcon code={current.code} night={!current.is_day} className="size-16 sm:size-20" />
      <span className="sr-only">{t(`weather.kind.${weatherKind(current.code)}`)}: </span>
      <span className="text-5xl font-extrabold tabular-nums sm:text-6xl">
        {t('weather.degrees', { value: Math.round(current.temperature) || 0 })}
      </span>
    </p>
  )
}

/** Je Person mit offenen Aufgaben: Avatar und die Symbole der Aufgaben, die heute noch fehlen. */
function OpenTasks() {
  const { members, today } = useFamilyToday()
  if (!members || !today) return null
  const rows = members
    .map((member) => ({
      member,
      open: currentTasks(tasksFor(today.tasks, member.id), member.id, today.date).filter(
        (task) => doneBy(task, member.id) === null,
      ),
    }))
    .filter((row) => row.open.length > 0)
  if (rows.length === 0) return null
  return (
    <ul className="flex flex-col items-end gap-2">
      {rows.map(({ member, open }) => (
        <OpenTasksRow key={member.id} member={member} open={open} />
      ))}
    </ul>
  )
}

function OpenTasksRow({
  member,
  open,
}: {
  member: Member
  open: { id: number; icon: string; title: string }[]
}) {
  const { t } = useTranslation()
  const rest = open.length - TASKS_PER_MEMBER
  return (
    <li
      aria-label={t('frame.open_tasks_of', { name: member.name, count: open.length })}
      className="flex items-center gap-2 rounded-full bg-black/35 py-1 pr-3 pl-1 backdrop-blur-sm"
    >
      <Avatar name={member.name} color={member.color} src={member.avatar_url} size="sm" />
      {open.slice(0, TASKS_PER_MEMBER).map((task) => (
        <span
          key={task.id}
          className="flex size-14 items-center justify-center rounded-full bg-white/90"
        >
          <TaskIcon icon={task.icon} className="size-10" />
        </span>
      ))}
      {rest > 0 && <span className="text-2xl font-extrabold tabular-nums">+{rest}</span>}
    </li>
  )
}
