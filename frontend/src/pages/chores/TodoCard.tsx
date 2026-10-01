import { useTranslation } from 'react-i18next'
import CheckIcon from '~icons/lucide/check'

import type { Todo } from '../../api/chores'
import type { Member } from '../../api/members'
import { Avatar } from '../../components/Avatar'
import { TaskIcon } from '../../components/TaskIcon'

/**
 * Eintrag aus „Zu erledigen“ als Karte wie die Hausarbeiten darunter, ohne Ampel: Einmaliges hat
 * keinen Abstand. Ein Tipp erledigt, ein weiterer am selben Tag nimmt es zurück.
 */
export function TodoCard({
  todo,
  doneBy,
  onToggle,
}: {
  todo: Todo
  /** Wer es heute erledigt hat, falls angegeben. */
  doneBy?: Member
  onToggle: () => void
}) {
  const { t } = useTranslation()

  return (
    <li>
      <button
        type="button"
        aria-pressed={todo.done}
        onClick={onToggle}
        className={`flex min-h-18 w-full items-center gap-3 rounded-3xl border-4 px-3 py-2 text-left shadow-sm transition-transform select-none focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-orange-400 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100 ${todo.done ? 'border-emerald-500 bg-emerald-50' : 'border-transparent border-l-slate-400 bg-white'}`}
      >
        <TaskIcon icon={todo.icon} className="size-12" />
        <span
          className={`min-w-0 flex-1 text-lg leading-tight font-extrabold break-words hyphens-auto ${todo.done ? 'text-slate-600 line-through decoration-emerald-500 decoration-2' : 'text-slate-800'}`}
        >
          {todo.title}
        </span>
        {todo.done &&
          (doneBy ? (
            <Avatar
              name={doneBy.name}
              color={doneBy.color}
              src={doneBy.avatar_url}
              size="sm"
              label={t('chores.done_by', { name: doneBy.name })}
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"
            >
              <CheckIcon className="size-2/3" strokeWidth={4} />
            </span>
          ))}
      </button>
    </li>
  )
}
