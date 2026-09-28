import { useTranslation } from 'react-i18next'
import AlarmIcon from '~icons/fluent-emoji-flat/alarm-clock'
import HourglassIcon from '~icons/fluent-emoji-flat/hourglass-not-done'
import CheckIcon from '~icons/lucide/check'

import type { Member } from '../../api/members'
import type { TodayTask } from '../../api/today'
import { Avatar } from '../../components/Avatar'
import { TaskIcon } from '../../components/TaskIcon'
import { errorMessage } from '../../errors'
import { colorTokens } from '../../memberColors'
import { PointsFeedback } from '../family/TaskCard'
import { useTaskToggle } from '../family/useTaskToggle'

/** Aufgabe als Symbol mit kurzem Titel: ein Tipp erledigt sie, ein weiterer nimmt es zurück. */
export function TaskChip({
  task,
  member,
  date,
}: {
  task: TodayTask
  member: Member
  date: string
}) {
  const { t } = useTranslation()
  const { done, doneByOther, pending, optional, dueIn, tapped, feedback, error, label, toggle } =
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
        className={`flex w-[4.5rem] flex-col items-center gap-0.5 rounded-xl border-[3px] px-0.5 pt-1.5 pb-1 ${optional && !done ? 'border-dashed' : ''} transition-transform select-none focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-orange-400 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100`}
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
          className={`size-10 ${doneByOther ? 'opacity-40 grayscale' : done && !pending ? 'opacity-60' : ''}`}
        />
        <span
          className={`line-clamp-2 w-full text-center text-xs leading-tight font-bold break-words hyphens-auto ${done ? 'text-slate-500 line-through' : 'text-slate-700'}`}
        >
          {task.title}
        </span>
      </button>
      {pending ? (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute -top-2 -right-2 flex size-7 items-center justify-center rounded-full bg-white shadow-sm ${pop}`}
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
            className={`pointer-events-none absolute -top-2 -right-2 flex size-7 items-center justify-center rounded-full ${pop}`}
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
