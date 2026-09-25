import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import AlarmIcon from '~icons/fluent-emoji-flat/alarm-clock'
import BeachIcon from '~icons/fluent-emoji-flat/beach-with-umbrella'
import ExtraIcon from '~icons/fluent-emoji-flat/flexed-biceps'
import StarIcon from '~icons/fluent-emoji-flat/glowing-star'
import HourglassIcon from '~icons/fluent-emoji-flat/hourglass-not-done'
import TrophyIcon from '~icons/fluent-emoji-flat/trophy'
import CheckIcon from '~icons/lucide/check'

import type { Member } from '../../api/members'
import { type Today, type TodayTask, doneBy, isUpcoming, pointsFor } from '../../api/today'
import { Avatar } from '../../components/Avatar'
import { TaskIcon } from '../../components/TaskIcon'
import { errorMessage } from '../../errors'
import { type CareSegment, careShares } from '../../care'
import { colorTokens } from '../../memberColors'
import type { PersonPageState } from '../PersonPage'
import { CareShare } from '../family/CareShare'
import { PointsFeedback } from '../family/TaskCard'
import { useTaskToggle } from '../family/useTaskToggle'
import { tasksFor, useFamilyToday } from '../family/useFamilyToday'
import { SetupHint, Widget } from './Widget'

/** Heutige Aufgaben aller Personen, kompakt: eine Zeile je Person, ein Symbol je Aufgabe. */
export function TasksWidget({ className }: { className?: string }) {
  const { t } = useTranslation()
  const { members, today, isPending, error } = useFamilyToday()

  return (
    <Widget
      title={t('home.tasks')}
      icon={StarIcon}
      more={{ to: '/tasks', label: t('home.open_tasks') }}
      className={className}
    >
      {isPending ? (
        <p role="status" className="text-lg text-slate-500">
          {t('common.loading')}
        </p>
      ) : !members || !today ? (
        <p className="text-lg text-slate-600">{errorMessage(t, error)}</p>
      ) : members.length === 0 ? (
        <SetupHint text={t('family.no_members_hint')} />
      ) : (
        <ul className="flex flex-col gap-3">
          {members.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              today={today}
              care={careShares(members, today)}
            />
          ))}
        </ul>
      )}
    </Widget>
  )
}

function MemberRow({
  member,
  today,
  care,
}: {
  member: Member
  today: Today
  /** Anteile der Erwachsenen an der Woche; null bei weniger als zwei Erwachsenen. */
  care: CareSegment[] | null
}) {
  const { t } = useTranslation()
  const tokens = colorTokens(member.color)
  // In der Reihenfolge der Routinen; flexible Aufgaben erst, wenn sie fällig sind.
  const tasks = tasksFor(today.tasks, member.id).filter(
    (task) => !isUpcoming(task, member.id, today.date),
  )
  const routine = tasks.filter((task) => !task.extra)
  const extras = tasks.filter((task) => task.extra)
  // Fortschritt: nur, was diese Person selbst erledigt hat. „Einer für alle“, von jemand
  // anderem erledigt, zählt für den anderen und fällt hier heraus.
  const own = routine.filter((task) => {
    const by = doneBy(task, member.id)
    return by === null || by === member.id
  })
  const done = own.filter((task) => doneBy(task, member.id) === member.id).length
  const points = pointsFor(today, member.id)
  const state: PersonPageState = { from: '/' }

  return (
    <li
      aria-label={t('family.tasks_of', { name: member.name })}
      className="flex gap-3 rounded-3xl border-l-8 bg-white p-3 shadow-sm"
      style={{ borderLeftColor: tokens.main }}
    >
      <Link
        to={`/member/${member.id}`}
        state={state}
        aria-label={t('family.open_person', { name: member.name })}
        className="flex w-20 shrink-0 flex-col items-center gap-1 rounded-2xl focus-visible:outline-4 focus-visible:outline-orange-400"
      >
        <Avatar name={member.name} color={member.color} src={member.avatar_url} size="sm" />
        <span className="w-full truncate text-center text-base font-extrabold text-slate-800">
          {member.name}
        </span>
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {member.role === 'parent' && care ? (
          // Wie in der Familienansicht: Erwachsene sehen ihren Anteil an der Woche.
          <CareShare member={member} shares={care} size="md" />
        ) : (
          own.length > 0 && (
            <div className="flex items-center gap-3">
              <span
                role="img"
                aria-label={t('points.progress', { done, total: own.length })}
                className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100"
              >
                <span
                  className="block h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none"
                  style={{ width: `${(done / own.length) * 100}%`, backgroundColor: tokens.main }}
                />
              </span>
              {member.role === 'child' && (
                <span className="flex shrink-0 items-center gap-1 text-lg font-extrabold text-slate-700 tabular-nums">
                  <TrophyIcon className="size-6" aria-hidden="true" />
                  <span className="sr-only">
                    {t('points.total_label', { count: points.total })}
                  </span>
                  <span aria-hidden="true">{points.total}</span>
                </span>
              )}
            </div>
          )
        )}
        {tasks.length === 0 ? (
          <p className="flex items-center gap-2 text-lg font-bold text-slate-500">
            <BeachIcon className="size-8" aria-hidden="true" />
            {t('family.free_today')}
          </p>
        ) : (
          <>
            {routine.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {routine.map((task) => (
                  <TaskChip key={task.id} task={task} member={member} date={today.date} />
                ))}
              </ul>
            )}
            {extras.length > 0 && (
              <section
                aria-label={t('family.extras')}
                className="flex flex-wrap items-center gap-2 border-t-2 border-dashed border-slate-200 pt-2"
              >
                <ExtraIcon className="size-8 shrink-0" aria-hidden="true" />
                <ul className="flex flex-wrap gap-2">
                  {extras.map((task) => (
                    <TaskChip key={task.id} task={task} member={member} date={today.date} />
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </li>
  )
}

/** Aufgabe als Symbol mit kurzem Titel: ein Tipp erledigt sie, ein weiterer nimmt es zurück. */
function TaskChip({ task, member, date }: { task: TodayTask; member: Member; date: string }) {
  const { t } = useTranslation()
  const { done, doneByOther, pending, dueIn, tapped, feedback, error, label, toggle } =
    useTaskToggle(task, member, date)
  const color = task.color ?? member.color
  const tokens = colorTokens(color)
  const pop = tapped ? 'motion-safe:animate-pop' : ''

  return (
    <li className="relative">
      <button
        type="button"
        aria-pressed={done}
        aria-label={label}
        title={task.title}
        onClick={toggle}
        className="flex w-24 flex-col items-center gap-1 rounded-2xl border-4 px-1 pt-2 pb-1 transition-transform select-none focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-orange-400 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
        style={
          doneByOther
            ? // Von jemand anderem erledigt: neutral statt in der eigenen Farbe.
              { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }
            : {
                backgroundColor: done ? tokens.soft : '#ffffff',
                borderColor: done ? tokens.main : tokens.soft,
              }
        }
      >
        <TaskIcon
          icon={task.icon}
          className={`size-12 ${doneByOther ? 'opacity-40 grayscale' : done && !pending ? 'opacity-60' : ''}`}
        />
        <span
          className={`line-clamp-2 w-full text-center text-sm leading-tight font-bold break-words hyphens-auto ${done ? 'text-slate-500 line-through' : 'text-slate-700'}`}
        >
          {task.title}
        </span>
      </button>
      {pending ? (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute -top-2 -right-2 flex size-8 items-center justify-center rounded-full bg-white shadow-sm ${pop}`}
        >
          <HourglassIcon className="size-6" />
        </span>
      ) : doneByOther ? (
        <span aria-hidden="true" className={`pointer-events-none absolute -top-2 -right-2 ${pop}`}>
          <Avatar
            name={doneByOther.name}
            color={doneByOther.color}
            src={doneByOther.avatar_url}
            size="xs"
          />
        </span>
      ) : (
        done && (
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute -top-2 -right-2 flex size-8 items-center justify-center rounded-full ${pop}`}
            style={{ backgroundColor: tokens.main, color: tokens.onMain }}
          >
            <CheckIcon className="size-5" strokeWidth={4} />
          </span>
        )
      )}
      {dueIn !== null && dueIn < 0 && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-2 -left-2 flex size-8 items-center justify-center rounded-full bg-red-100 shadow-sm"
        >
          <AlarmIcon className="size-6" />
        </span>
      )}
      <PointsFeedback
        task={task}
        count={feedback}
        color={color}
        className="-top-5 left-2 text-lg"
      />
      {error ? (
        <p
          role="alert"
          className="absolute top-full left-0 z-10 mt-1 w-48 rounded-xl bg-red-50 px-2 py-1 text-sm font-semibold text-red-700 shadow"
        >
          {errorMessage(t, error)}
        </p>
      ) : null}
    </li>
  )
}
