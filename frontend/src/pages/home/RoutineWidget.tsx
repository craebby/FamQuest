import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import PartyIcon from '~icons/fluent-emoji-flat/party-popper'
import TrophyIcon from '~icons/fluent-emoji-flat/trophy'

import type { Member } from '../../api/members'
import { blockOf } from '../../api/tasks'
import { type Today, isDoneFor, isUpcoming, pointsFor } from '../../api/today'
import { Avatar } from '../../components/Avatar'
import { TIME_OF_DAY_ICONS } from '../../components/TimeOfDayIcon'
import { errorMessage } from '../../errors'
import { colorTokens } from '../../memberColors'
import type { PersonPageState } from '../PersonPage'
import { tasksFor, useFamilyToday } from '../family/useFamilyToday'
import { TaskChip } from './TaskChip'
import { SetupHint, Widget } from './Widget'

/**
 * Was die Kinder gerade zu tun haben: die Routine des aktuellen Tagesabschnitts, ein Tipp erledigt
 * eine Aufgabe. Ist sie geschafft (oder gerade keine dran), steht dort nur „Alles erledigt“.
 * Erwachsene stehen hier nicht; ihre Hausarbeit zeigt die Kachel „Haushalt“ daneben.
 */
export function RoutineWidget({ className }: { className?: string }) {
  const { t } = useTranslation()
  const { members, today, isPending, error } = useFamilyToday()
  const children = members?.filter((member) => member.role === 'child') ?? []
  const block = today?.time_of_day

  return (
    <Widget
      title={block ? t(`times_of_day.${block}`) : t('home.routine')}
      icon={block ? TIME_OF_DAY_ICONS[block] : TrophyIcon}
      more={{ to: '/tasks', label: t('home.open_tasks') }}
      className={className}
    >
      {isPending ? (
        <p role="status" className="text-lg text-slate-500">
          {t('common.loading')}
        </p>
      ) : !members || !today ? (
        <p className="text-lg text-slate-600">{errorMessage(t, error)}</p>
      ) : children.length === 0 ? (
        <SetupHint text={t('home.no_children')} to="/parents/family" />
      ) : (
        <ul className="grid gap-3 xl:grid-cols-2">
          {children.map((child) => (
            <ChildRoutine key={child.id} child={child} today={today} />
          ))}
        </ul>
      )}
    </Widget>
  )
}

/** So lange bleibt die zuletzt erledigte Aufgabe stehen, damit ihr Feedback zu sehen ist. */
export const ALL_DONE_DELAY_MS = 1500

/** `value`, aber ein Wechsel auf true kommt erst nach `delay` an (auf false sofort). */
function useDelayedTrue(value: boolean, delay: number) {
  const [previous, setPrevious] = useState(value)
  const [delayed, setDelayed] = useState(value)
  // Beim Wechsel auf false gleich zurücksetzen (während des Renderns, ohne Effekt).
  if (value !== previous) {
    setPrevious(value)
    if (!value) setDelayed(false)
  }
  useEffect(() => {
    if (!value || delayed) return
    const timer = setTimeout(() => setDelayed(true), delay)
    return () => clearTimeout(timer)
  }, [value, delayed, delay])
  return value && delayed
}

function ChildRoutine({ child, today }: { child: Member; today: Today }) {
  const { t } = useTranslation()
  const tokens = colorTokens(child.color)
  // Nur der aktuelle Tagesabschnitt, ohne Extras und „Jederzeit“.
  const tasks = tasksFor(today.tasks, child.id).filter(
    (task) => blockOf(task) === today.time_of_day && !isUpcoming(task, child.id, today.date),
  )
  const allDone = useDelayedTrue(
    tasks.every((task) => isDoneFor(task, child.id)),
    ALL_DONE_DELAY_MS,
  )
  const points = pointsFor(today, child.id)
  const state: PersonPageState = { from: '/' }

  return (
    <li
      aria-label={t('family.tasks_of', { name: child.name })}
      className="flex items-center gap-3 rounded-3xl border-l-8 bg-white p-3 shadow-sm"
      style={{ borderLeftColor: tokens.main }}
    >
      <Link
        to={`/member/${child.id}`}
        state={state}
        aria-label={t('family.open_person', { name: child.name })}
        className="flex w-20 shrink-0 flex-col items-center gap-1 rounded-2xl focus-visible:outline-4 focus-visible:outline-orange-400"
      >
        <Avatar name={child.name} color={child.color} src={child.avatar_url} size="sm" />
        <span className="w-full truncate text-center text-base font-extrabold text-slate-800">
          {child.name}
        </span>
        <span className="flex items-center gap-1 text-base font-extrabold text-slate-700 tabular-nums">
          <TrophyIcon className="size-5" aria-hidden="true" />
          <span className="sr-only">{t('points.total_label', { count: points.total })}</span>
          <span aria-hidden="true">{points.total}</span>
        </span>
      </Link>
      {allDone ? (
        <p className="flex items-center gap-3 text-xl font-extrabold text-slate-700">
          <PartyIcon className="size-12" aria-hidden="true" />
          {t('home.all_done')}
        </p>
      ) : (
        <ul className="flex min-w-0 flex-1 flex-wrap gap-2">
          {tasks.map((task) => (
            <TaskChip key={task.id} task={task} member={child} date={today.date} />
          ))}
        </ul>
      )}
    </li>
  )
}
