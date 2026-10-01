import { useTranslation } from 'react-i18next'
import CheckIcon from '~icons/lucide/check'

import type { Chore, ChoreRoom } from '../../api/chores'
import type { Member } from '../../api/members'
import { LEVEL_COLORS, statusText } from '../../chores'
import { Avatar } from '../../components/Avatar'
import { TaskIcon } from '../../components/TaskIcon'

/**
 * Hausarbeit als Karte wie die Aufgaben der Kinder daneben: links die Ampelfarbe statt der
 * Personenfarbe. Ein Tipp erledigt sie, ein weiterer am selben Tag nimmt es zurück.
 */
export function ChoreCard({
  chore,
  room,
  doneBy,
  onToggle,
}: {
  chore: Chore
  room?: ChoreRoom
  /** Wer es heute erledigt hat, falls angegeben. */
  doneBy?: Member
  onToggle: () => void
}) {
  const { t } = useTranslation()
  const colors = LEVEL_COLORS[chore.level]
  const done = chore.done_today

  return (
    <li>
      <button
        type="button"
        aria-pressed={done}
        onClick={onToggle}
        className={`flex min-h-18 w-full items-center gap-3 rounded-3xl border-4 px-3 py-2 text-left shadow-sm transition-transform select-none focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-orange-400 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100 ${done ? 'border-emerald-500 bg-emerald-50' : `border-transparent bg-white ${colors.edge}`}`}
      >
        <TaskIcon icon={chore.icon} className="size-12" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span
            className={`text-lg leading-tight font-extrabold break-words hyphens-auto ${done ? 'text-slate-600 line-through decoration-emerald-500 decoration-2' : 'text-slate-800'}`}
          >
            {chore.title}
          </span>
          {room && (
            <span className="text-base leading-tight break-words text-slate-500">{room.name}</span>
          )}
          <span
            className={`text-base leading-tight font-bold ${done ? 'text-slate-500' : colors.text}`}
          >
            {statusText(t, chore)}
          </span>
        </span>
        {done &&
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
