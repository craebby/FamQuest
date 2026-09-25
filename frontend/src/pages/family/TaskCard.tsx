import { useTranslation } from 'react-i18next'
import AlarmIcon from '~icons/fluent-emoji-flat/alarm-clock'
import HourglassIcon from '~icons/fluent-emoji-flat/hourglass-not-done'
import StarIcon from '~icons/fluent-emoji-flat/star'
import CheckIcon from '~icons/lucide/check'

import type { Member } from '../../api/members'
import type { TodayTask } from '../../api/today'
import { Avatar } from '../../components/Avatar'
import { TaskIcon } from '../../components/TaskIcon'
import { errorMessage } from '../../errors'
import { type MemberColor, colorTokens } from '../../memberColors'
import { useTaskToggle } from './useTaskToggle'

export type CardSize = 'md' | 'lg'

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

/** „+2 ⭐“ über der Aufgabe, kurz nach dem Abhaken; mit Sanduhr, wenn die Eltern noch prüfen. */
export function PointsFeedback({
  task,
  count,
  className,
  color,
}: {
  task: TodayTask
  /** Zähler aus `useTaskToggle`; jeder neue Wert startet die Animation neu. */
  count: number
  className: string
  color: MemberColor
}) {
  const tokens = colorTokens(color)
  if (!count) return null
  return (
    <span
      key={count}
      data-testid="points-feedback"
      aria-hidden="true"
      className={`pointer-events-none absolute flex items-center gap-1 rounded-full px-3 py-1 font-extrabold shadow-md motion-safe:animate-float-up ${className}`}
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
  )
}

/** Aufgabenkarte: ein Tipp erledigt sie für diese Person, ein weiterer nimmt es zurück. */
export function TaskCard({ task, member, date, size }: TaskCardProps) {
  const { t } = useTranslation()
  const { done, doneByOther, pending, dueIn, showPoints, tapped, feedback, error, label, toggle } =
    useTaskToggle(task, member, date)
  const tokens = colorTokens(task.color ?? member.color)
  const sizes = SIZES[size]

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        aria-pressed={done}
        aria-label={label}
        onClick={toggle}
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
        <PointsFeedback
          task={task}
          count={feedback}
          color={task.color ?? member.color}
          className={`-top-4 right-3 ${sizes.feedback}`}
        />
      </button>
      {error ? (
        <p role="alert" className="px-2 text-base font-semibold text-red-700">
          {errorMessage(t, error)}
        </p>
      ) : null}
    </div>
  )
}
