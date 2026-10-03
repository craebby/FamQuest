import { useTranslation } from 'react-i18next'
import BroomIcon from '~icons/fluent-emoji-flat/broom'
import GoodIcon from '~icons/fluent-emoji-flat/check-mark-button'

import { type Chore, type Todo, useChores } from '../../api/chores'
import { LEVEL_COLORS, statusText, urgentChores } from '../../chores'
import { TaskIcon } from '../../components/TaskIcon'
import { errorMessage } from '../../errors'
import { WhoBar } from '../chores/WhoBar'
import { useChoreDone } from '../chores/useChoreDone'
import { areaPath } from '../parents/areas'
import { SetupHint, Widget } from './Widget'

/**
 * So viele Einträge zeigt die Kachel (je eine Zeile), der Rest steht als „+3 weitere“ dabei. Die
 * Kachel bleibt so niedrig, dass die Woche darunter ihren Platz behält.
 */
export const WIDGET_MAX_CHORES = 2

/**
 * Haushalt auf der Startseite: was offen in „Zu erledigen“ steht und was im Putzplan rot oder
 * gelb ist. Ein Tipp erledigt, die Leiste „Wer war's?“ erscheint wie in der Ansicht „Haushalt“ und
 * nimmt den Tipp mit „Rückgängig“ zurück. Erledigtes verschwindet aus der Kachel; durchgestrichen
 * steht es bis zum Tagesende nur in der Ansicht „Haushalt“.
 */
export function ChoresWidget() {
  const { t } = useTranslation()
  const plan = useChores()
  const chores = (plan.data?.chores ?? []).filter((chore) => chore.active)
  const todos = plan.data?.todos ?? []
  const done = useChoreDone(chores, todos)
  const urgent = urgentChores(chores)
  // Erst das ausdrücklich Eingetragene, dann der Putzplan.
  const entries: Entry[] = [
    ...todos.filter((todo) => !todo.done).map((todo) => ({ todo })),
    ...urgent.map((chore) => ({ chore })),
  ]
  const shown = entries.slice(0, WIDGET_MAX_CHORES)
  const hidden = entries.length - shown.length
  const roomName = (chore: Chore) =>
    plan.data?.rooms.find((room) => room.id === chore.room_id)?.name

  return (
    <Widget
      title={t('home.chores')}
      icon={BroomIcon}
      more={{ to: '/household', label: t('home.open_chores') }}
    >
      {plan.isPending ? (
        <p role="status" className="text-lg text-slate-500">
          {t('common.loading')}
        </p>
      ) : !plan.data ? (
        <p className="text-lg text-slate-600">{errorMessage(t, plan.error)}</p>
      ) : chores.length === 0 && todos.length === 0 ? (
        <SetupHint text={t('home.chores_setup')} to={areaPath('household')} />
      ) : (
        <>
          {entries.length === 0 && (
            <p className="flex items-center gap-2 text-xl font-bold text-slate-600">
              <GoodIcon className="size-9 shrink-0" aria-hidden="true" />
              {t('home.chores_all_good')}
            </p>
          )}
          {shown.length > 0 && (
            <ul aria-label={t('home.chores_due')} className="flex flex-col items-start gap-2">
              {shown.map(({ chore, todo }) =>
                chore ? (
                  <ChoreChip
                    key={`chore-${chore.id}`}
                    chore={chore}
                    room={roomName(chore)}
                    onToggle={() => done.toggle(chore)}
                  />
                ) : todo ? (
                  <TodoChip
                    key={`todo-${todo.id}`}
                    todo={todo}
                    onToggle={() => done.toggleTodo(todo)}
                  />
                ) : null,
              )}
              {hidden > 0 && (
                <li className="px-2 text-lg font-bold text-slate-500">
                  {t('shopping.more', { count: hidden })}
                </li>
              )}
            </ul>
          )}
        </>
      )}
      {done.error ? (
        <p role="alert" className="text-base font-semibold text-red-700">
          {errorMessage(t, done.error)}
        </p>
      ) : null}
      <WhoBar done={done} />
    </Widget>
  )
}

/** Eine Zeile der Kachel: Hausarbeit aus dem Putzplan oder Eintrag aus „Zu erledigen“. */
interface Entry {
  chore?: Chore
  todo?: Todo
}

const CHIP_CLASS =
  'flex min-h-12 max-w-full items-center gap-2 rounded-2xl py-1 pr-3 pl-2 text-left transition-transform select-none focus-visible:outline-4 focus-visible:outline-orange-400 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100'

/** Eintrag aus „Zu erledigen“ als Symbol mit Namen; der leere Kreis heißt „noch offen“. */
function TodoChip({ todo, onToggle }: { todo: Todo; onToggle: () => void }) {
  return (
    <li className="max-w-full min-w-0">
      <button
        type="button"
        aria-pressed={false}
        title={todo.title}
        onClick={onToggle}
        className={`${CHIP_CLASS} bg-orange-50`}
      >
        <span
          aria-hidden="true"
          className="size-5 shrink-0 rounded-full bg-white ring-2 ring-slate-400 ring-inset"
        />
        <TaskIcon icon={todo.icon} className="size-10" />
        <span className="min-w-0 truncate text-lg leading-tight font-bold text-slate-800">
          {todo.title}
        </span>
      </button>
    </li>
  )
}

/** Hausarbeit als Symbol mit Namen; die Ampelfarbe zeigt, wie dringend sie ist. */
function ChoreChip({
  chore,
  room,
  onToggle,
}: {
  chore: Chore
  room: string | undefined
  onToggle: () => void
}) {
  const { t } = useTranslation()
  const colors = LEVEL_COLORS[chore.level]
  const status = statusText(t, chore)

  return (
    <li className="max-w-full min-w-0">
      <button
        type="button"
        aria-pressed={false}
        aria-label={[chore.title, room, status].filter(Boolean).join(', ')}
        title={[chore.title, room, status].filter(Boolean).join(' · ')}
        onClick={onToggle}
        className={`${CHIP_CLASS} ${colors.soft}`}
      >
        <span aria-hidden="true" className={`size-5 shrink-0 rounded-full ${colors.fill}`} />
        <TaskIcon icon={chore.icon} className="size-10" />
        <span className="min-w-0 truncate text-lg leading-tight font-bold text-slate-800">
          {chore.title}
        </span>
      </button>
    </li>
  )
}
