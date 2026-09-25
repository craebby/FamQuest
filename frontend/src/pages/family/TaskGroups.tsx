import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import BeachIcon from '~icons/fluent-emoji-flat/beach-with-umbrella'
import SoonIcon from '~icons/fluent-emoji-flat/spiral-calendar'
import CheckIcon from '~icons/fluent-emoji-flat/check-mark-button'
import SparklesIcon from '~icons/fluent-emoji-flat/sparkles'
import ChevronIcon from '~icons/lucide/chevron-down'

import type { Member } from '../../api/members'
import { TIMES_OF_DAY, type TimeOfDay } from '../../api/tasks'
import { type TodayTask, daysUntilDue, isDoneFor, isUpcoming } from '../../api/today'
import { TIME_OF_DAY_ICONS } from '../../components/TimeOfDayIcon'
import { colorTokens } from '../../memberColors'
import { type CardSize, TaskCard } from './TaskCard'

/** So lange bleibt ein gerade fertig gewordener Abschnitt offen, damit man den Haken sieht. */
export const COLLAPSE_DELAY_MS = 1200

interface TaskGroupsProps {
  member: Member
  /** Heutige Aufgaben dieser Person. */
  tasks: TodayTask[]
  date: string
  currentTimeOfDay: TimeOfDay
  size: CardSize
}

/** Aufgaben einer Person, gruppiert nach Tagesabschnitt; „Jederzeit“ steht am Ende. */
export function TaskGroups({ member, tasks, date, currentTimeOfDay, size }: TaskGroupsProps) {
  const { t } = useTranslation()

  const upcoming = tasks
    .filter((task) => isUpcoming(task, member.id, date))
    .sort(
      (a, b) => (daysUntilDue(a, member.id, date) ?? 0) - (daysUntilDue(b, member.id, date) ?? 0),
    )
  const current = tasks.filter((task) => !upcoming.includes(task))
  const groups = [...TIMES_OF_DAY, null]
    .map((timeOfDay) => ({
      timeOfDay,
      tasks: current.filter((task) => task.time_of_day === timeOfDay),
    }))
    .filter((group) => group.tasks.length > 0)

  return (
    <div className="flex flex-col gap-3">
      {current.length === 0 && (
        <p className="flex flex-col items-center gap-3 py-8 text-center text-2xl font-bold text-slate-600">
          <BeachIcon className="size-24" aria-hidden="true" />
          {t('family.free_today')}
        </p>
      )}
      {groups.map((group) => (
        <TaskGroup
          key={group.timeOfDay ?? 'anytime'}
          member={member}
          timeOfDay={group.timeOfDay}
          tasks={group.tasks}
          date={date}
          current={group.timeOfDay === currentTimeOfDay}
          size={size}
        />
      ))}
      {upcoming.length > 0 && (
        <section aria-label={t('family.upcoming')} className="mt-2 flex flex-col gap-2 px-1">
          <h3 className="flex items-center gap-3 text-lg font-extrabold text-slate-500">
            <SoonIcon
              className={`${size === 'lg' ? 'size-10' : 'size-8'} shrink-0 opacity-70`}
              aria-hidden="true"
            />
            {t('family.upcoming')}
          </h3>
          {upcoming.map((task) => (
            <TaskCard key={task.id} task={task} member={member} date={date} size="sm" />
          ))}
        </section>
      )}
    </div>
  )
}

interface TaskGroupProps {
  member: Member
  timeOfDay: TimeOfDay | null
  tasks: TodayTask[]
  date: string
  current: boolean
  size: CardSize
}

function TaskGroup({ member, timeOfDay, tasks, date, current, size }: TaskGroupProps) {
  const { t } = useTranslation()
  const tokens = colorTokens(member.color)
  const allDone = tasks.every((task) => isDoneFor(task, member.id))
  // Ein gerade fertig gewordener Abschnitt klappt erst verzögert zu; beim Laden sofort.
  const [delayPassed, setDelayPassed] = useState(allDone)
  const [expanded, setExpanded] = useState(false)
  const [previousAllDone, setPreviousAllDone] = useState(allDone)
  if (allDone !== previousAllDone) {
    setPreviousAllDone(allDone)
    setDelayPassed(false)
    setExpanded(false)
  }
  useEffect(() => {
    if (!allDone) return
    const timer = window.setTimeout(() => setDelayPassed(true), COLLAPSE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [allDone])
  const collapsible = allDone && delayPassed
  const Icon = timeOfDay ? TIME_OF_DAY_ICONS[timeOfDay] : SparklesIcon
  const label = t(timeOfDay ? `times_of_day.${timeOfDay}` : 'tasks.anytime')
  const iconSize = size === 'lg' ? 'size-12' : 'size-9'

  if (collapsible && !expanded) {
    return (
      <button
        type="button"
        aria-expanded={false}
        onClick={() => setExpanded(true)}
        className="flex min-h-14 items-center gap-3 rounded-3xl bg-white/60 px-4 py-2 text-left text-lg font-bold text-slate-600 focus-visible:outline-4 focus-visible:outline-orange-400"
      >
        <Icon className={`${iconSize} shrink-0 opacity-70`} aria-hidden="true" />
        <span className="sr-only">{t('family.section_done', { section: label })}</span>
        <span aria-hidden="true" className="flex-1">
          {label}
        </span>
        <CheckIcon className="size-9 shrink-0" aria-hidden="true" />
      </button>
    )
  }

  return (
    <section
      aria-label={label}
      className={`flex flex-col gap-3 rounded-3xl ${current ? 'p-3 ring-4' : 'px-1'}`}
      style={
        current
          ? { backgroundColor: tokens.soft, ['--tw-ring-color' as string]: tokens.main }
          : undefined
      }
    >
      <h3 className="flex items-center gap-3 text-lg font-extrabold text-slate-700">
        {collapsible ? (
          <button
            type="button"
            aria-expanded
            onClick={() => setExpanded(false)}
            className="flex min-h-12 flex-1 items-center gap-3 rounded-2xl text-left focus-visible:outline-4 focus-visible:outline-orange-400"
          >
            <Icon className={`${iconSize} shrink-0`} aria-hidden="true" />
            <span className="flex-1">{label}</span>
            <ChevronIcon className="size-7 rotate-180" aria-hidden="true" />
          </button>
        ) : (
          <>
            <Icon className={`${iconSize} shrink-0`} aria-hidden="true" />
            <span className="flex-1">{label}</span>
            {current && (
              <span
                className="rounded-full px-3 py-1 text-sm font-extrabold"
                style={{ backgroundColor: tokens.main, color: tokens.onMain }}
              >
                {t('family.now')}
              </span>
            )}
          </>
        )}
      </h3>
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} member={member} date={date} size={size} />
      ))}
    </section>
  )
}
