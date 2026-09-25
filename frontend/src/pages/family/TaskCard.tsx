import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import StarIcon from '~icons/fluent-emoji-flat/star'
import CheckIcon from '~icons/lucide/check'

import { ApiError } from '../../api/client'
import type { Member } from '../../api/members'
import { type TodayTask, useSetDone } from '../../api/today'
import { TaskIcon } from '../../components/TaskIcon'
import { errorMessage } from '../../errors'
import { colorTokens } from '../../memberColors'

export type CardSize = 'md' | 'lg'

/** So lange ist „+2 Punkte“ nach dem Abhaken zu sehen (auch ohne Animation). */
export const POINTS_FEEDBACK_MS = 1200

const SIZES = {
  md: {
    card: 'min-h-24 gap-3 p-3',
    icon: 'size-16',
    title: 'text-xl',
    badge: 'size-9',
    feedback: 'text-2xl',
  },
  lg: {
    card: 'min-h-32 gap-5 p-5',
    icon: 'size-24',
    title: 'text-3xl',
    badge: 'size-12',
    feedback: 'text-4xl',
  },
} as const

interface TaskCardProps {
  task: TodayTask
  member: Member
  /** Tag, den die Ansicht zeigt (`YYYY-MM-DD`). */
  date: string
  size: CardSize
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
  const done = task.done_member_ids.includes(member.id)
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
        aria-label={t('family.task_label', {
          title: task.title,
          points: t('tasks.points_count', { count: task.points }),
        })}
        onClick={() => {
          setTapped(true)
          if (!done && task.points > 0) setFeedback((count) => count + 1)
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
          <span className="flex items-center gap-1 text-lg font-bold text-slate-600">
            <StarIcon className="size-6" aria-hidden="true" />
            {task.points}
          </span>
        </span>
        {done && (
          <span
            className={`flex shrink-0 items-center justify-center rounded-full ${tapped ? 'motion-safe:animate-pop' : ''} ${sizes.badge}`}
            style={{ backgroundColor: tokens.main, color: tokens.onMain }}
            aria-hidden="true"
          >
            <CheckIcon className="size-2/3" strokeWidth={4} />
          </span>
        )}
        {feedback > 0 && (
          <span
            key={feedback}
            data-testid="points-feedback"
            aria-hidden="true"
            className={`pointer-events-none absolute -top-4 right-3 flex items-center gap-1 rounded-full px-3 py-1 font-extrabold shadow-md motion-safe:animate-float-up ${sizes.feedback}`}
            style={{ backgroundColor: tokens.main, color: tokens.onMain }}
          >
            +{task.points}
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
