import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AlarmIcon from '~icons/fluent-emoji-flat/alarm-clock'
import HourglassIcon from '~icons/fluent-emoji-flat/hourglass-not-done'
import StarIcon from '~icons/fluent-emoji-flat/star'
import CheckIcon from '~icons/lucide/check'

import { ApiError } from '../../api/client'
import { type Member, useMembers } from '../../api/members'
import { type TodayTask, daysUntilDue, doneBy, isPendingFor, useSetDone } from '../../api/today'
import { Avatar } from '../../components/Avatar'
import { TaskIcon } from '../../components/TaskIcon'
import { errorMessage } from '../../errors'
import { colorTokens } from '../../memberColors'

export type CardSize = 'md' | 'lg'

/** So lange ist „+2 Punkte“ nach dem Abhaken zu sehen (auch ohne Animation). */
export const POINTS_FEEDBACK_MS = 1200

const SIZES = {
  // Klein und blass: flexible Aufgaben unter „Demnächst“.
  sm: {
    card: 'min-h-16 gap-3 p-2 opacity-75',
    icon: 'size-10',
    title: 'text-lg',
    badge: 'size-8',
    feedback: 'text-xl',
    points: 'text-base',
  },
  md: {
    card: 'min-h-18 gap-3 px-3 py-2',
    icon: 'size-12',
    title: 'text-lg',
    badge: 'size-9',
    feedback: 'text-2xl',
    points: 'text-base',
  },
  lg: {
    card: 'min-h-32 gap-5 p-5',
    icon: 'size-24',
    title: 'text-3xl',
    badge: 'size-12',
    feedback: 'text-4xl',
    points: 'text-lg',
  },
} as const

interface TaskCardProps {
  task: TodayTask
  member: Member
  /** Tag, den die Ansicht zeigt (`YYYY-MM-DD`). */
  date: string
  size: CardSize | 'sm'
}

/** Aufgabenkarte: ein Tipp erledigt sie für diese Person, ein weiterer nimmt es zurück. */
export function TaskCard({ task, member, date, size }: TaskCardProps) {
  const { t } = useTranslation()
  const setDone = useSetDone(task.id, member.id)
  // Die Haken-Animation gibt es nur direkt nach dem Antippen, nicht bei jedem Laden.
  const [tapped, setTapped] = useState(false)
  // Zähler für „+2 Punkte“; jeder neue Tipp startet die Anzeige neu (0 = nichts anzeigen).
  const [feedback, setFeedback] = useState(0)
  useEffect(() => {
    if (!feedback) return
    const timer = window.setTimeout(() => setFeedback(0), POINTS_FEEDBACK_MS)
    return () => window.clearTimeout(timer)
  }, [feedback])
  const members = useMembers().data
  const completer = doneBy(task, member.id)
  const done = completer !== null
  // „Einer für alle“, von jemand anderem erledigt: dessen Avatar statt des Hakens.
  const doneByOther =
    completer !== null && completer !== member.id
      ? members?.find((candidate) => candidate.id === completer)
      : undefined
  // Erledigt, aber die Eltern müssen noch prüfen: Sanduhr statt Haken, noch keine Punkte.
  const pending = isPendingFor(task, member.id)
  // Flexible Aufgaben: negativ = überfällig, positiv = demnächst.
  const dueIn = daysUntilDue(task, member.id, date)
  // Erwachsene sammeln keine Punkte; bei ihnen zählt nur, dass es erledigt ist.
  const showPoints = member.role !== 'parent'
  const tokens = colorTokens(task.color ?? member.color)
  const sizes = SIZES[size]
  // Ein Tageswechsel wird still behoben: die Ansicht lädt den neuen Tag.
  const error =
    setDone.error instanceof ApiError && setDone.error.code === 'completion.day_changed'
      ? null
      : setDone.error

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        aria-pressed={done}
        aria-label={[
          showPoints
            ? t('family.task_label', {
                title: task.title,
                points: t('tasks.points_count', { count: task.points }),
              })
            : task.title,
          ...(pending ? [t('family.pending')] : []),
          ...(doneByOther ? [t('family.done_by', { name: doneByOther.name })] : []),
          ...(dueIn !== null && dueIn < 0 ? [t('family.overdue', { count: -dueIn })] : []),
          ...(dueIn !== null && dueIn > 0 ? [t('family.due_in', { count: dueIn })] : []),
        ].join(', ')}
        onClick={() => {
          setTapped(true)
          if (!done && showPoints && task.points > 0) setFeedback((count) => count + 1)
          setDone.mutate({ date, taskId: task.id, memberId: member.id, done: !done })
        }}
        className={`relative flex w-full items-center rounded-3xl border-4 text-left shadow-sm transition-transform select-none focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-orange-400 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100 ${sizes.card}`}
        style={{
          backgroundColor: done ? tokens.soft : '#ffffff',
          borderColor: done ? tokens.main : 'transparent',
          borderLeftColor: tokens.main,
        }}
      >
        <TaskIcon icon={task.icon} className={sizes.icon} />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span
            className={`font-extrabold break-words hyphens-auto ${sizes.title} ${done ? 'text-slate-600 line-through decoration-2' : 'text-slate-800'}`}
            style={done ? { textDecorationColor: tokens.main } : undefined}
          >
            {task.title}
          </span>
          {showPoints && (
            <span className={`flex items-center gap-1 font-bold text-slate-600 ${sizes.points}`}>
              <StarIcon className="size-[1.25em]" aria-hidden="true" />
              {task.points}
            </span>
          )}
          {dueIn !== null && dueIn < 0 && (
            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-base font-bold text-red-800">
              <AlarmIcon className="size-5" aria-hidden="true" />
              {t('family.overdue', { count: -dueIn })}
            </span>
          )}
          {dueIn !== null && dueIn > 0 && (
            <span className="text-base font-bold text-slate-500">
              {t('family.due_in', { count: dueIn })}
            </span>
          )}
        </span>
        {pending ? (
          <span
            data-testid="pending-badge"
            className={`flex shrink-0 items-center justify-center rounded-full bg-white shadow-sm ${tapped ? 'motion-safe:animate-pop' : ''} ${sizes.badge}`}
            aria-hidden="true"
          >
            <HourglassIcon className="size-3/4" />
          </span>
        ) : doneByOther ? (
          <span
            data-testid="done-by"
            className={`shrink-0 ${tapped ? 'motion-safe:animate-pop' : ''}`}
            aria-hidden="true"
          >
            <Avatar
              name={doneByOther.name}
              color={doneByOther.color}
              src={doneByOther.avatar_url}
              size="sm"
            />
          </span>
        ) : (
          done && (
            <span
              className={`flex shrink-0 items-center justify-center rounded-full ${tapped ? 'motion-safe:animate-pop' : ''} ${sizes.badge}`}
              style={{ backgroundColor: tokens.main, color: tokens.onMain }}
              aria-hidden="true"
            >
              <CheckIcon className="size-2/3" strokeWidth={4} />
            </span>
          )
        )}
        {feedback > 0 && (
          <span
            key={feedback}
            data-testid="points-feedback"
            aria-hidden="true"
            className={`pointer-events-none absolute -top-4 right-3 flex items-center gap-1 rounded-full px-3 py-1 font-extrabold shadow-md motion-safe:animate-float-up ${sizes.feedback}`}
            style={
              task.needs_approval
                ? { backgroundColor: '#ffffff', color: '#475569' }
                : { backgroundColor: tokens.main, color: tokens.onMain }
            }
          >
            {task.needs_approval && <HourglassIcon className="size-[1.2em]" aria-hidden="true" />}+
            {task.points}
            <StarIcon className="size-[1.2em]" aria-hidden="true" />
          </span>
        )}
      </button>
      {error ? (
        <p role="alert" className="px-2 text-base font-semibold text-red-700">
          {errorMessage(t, error)}
        </p>
      ) : null}
    </div>
  )
}
