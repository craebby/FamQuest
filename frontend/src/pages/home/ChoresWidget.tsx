import { useTranslation } from 'react-i18next'
import BroomIcon from '~icons/fluent-emoji-flat/broom'
import GoodIcon from '~icons/fluent-emoji-flat/check-mark-button'
import CheckIcon from '~icons/lucide/check'

import { type Chore, useChores } from '../../api/chores'
import { LEVEL_COLORS, byUrgency, statusText, urgentChores } from '../../chores'
import { TaskIcon } from '../../components/TaskIcon'
import { errorMessage } from '../../errors'
import { WhoBar } from '../chores/WhoBar'
import { useChoreDone } from '../chores/useChoreDone'
import { areaPath } from '../parents/areas'
import { SetupHint, Widget } from './Widget'

/** So viele Aufgaben zeigt die Kachel, der Rest steht als „+3 weitere“ dabei. */
export const WIDGET_MAX_CHORES = 6

/**
 * Haushalt auf der Startseite: nur was im Putzplan rot oder gelb ist. Ein Tipp erledigt, die
 * Leiste „Wer war's?“ erscheint wie in der Ansicht „Haushalt“; Erledigtes bleibt bis zum
 * Tagesende durchgestrichen stehen, damit ein zweiter Tipp es zurücknehmen kann.
 */
export function ChoresWidget() {
  const { t } = useTranslation()
  const plan = useChores()
  const chores = (plan.data?.chores ?? []).filter((chore) => chore.active)
  const done = useChoreDone(chores)
  const urgent = urgentChores(chores)
  const doneToday = chores.filter((chore) => chore.done_today).sort(byUrgency)
  const shown = [...urgent, ...doneToday].slice(0, WIDGET_MAX_CHORES)
  const hidden = urgent.length - shown.filter((chore) => !chore.done_today).length
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
      ) : chores.length === 0 ? (
        <SetupHint text={t('home.chores_setup')} to={areaPath('household')} />
      ) : (
        <>
          {urgent.length === 0 && (
            <p className="flex items-center gap-2 text-xl font-bold text-slate-600">
              <GoodIcon className="size-9 shrink-0" aria-hidden="true" />
              {t('home.chores_all_good')}
            </p>
          )}
          {shown.length > 0 && (
            <ul aria-label={t('home.chores_due')} className="flex flex-wrap gap-2">
              {shown.map((chore) => (
                <ChoreChip
                  key={chore.id}
                  chore={chore}
                  room={roomName(chore)}
                  onToggle={() => done.toggle(chore)}
                />
              ))}
              {hidden > 0 && (
                <li className="flex items-center px-2 text-lg font-bold text-slate-500">
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
  const done = chore.done_today
  const status = statusText(t, chore)

  return (
    <li className="min-w-0">
      <button
        type="button"
        aria-pressed={done}
        aria-label={[chore.title, room, status].filter(Boolean).join(', ')}
        title={[room, status].filter(Boolean).join(' · ')}
        onClick={onToggle}
        className={`flex min-h-12 max-w-full items-center gap-2 rounded-2xl py-1 pr-3 pl-2 text-left transition-transform select-none focus-visible:outline-4 focus-visible:outline-orange-400 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100 ${done ? 'bg-slate-100' : colors.soft}`}
      >
        {done ? (
          <span
            aria-hidden="true"
            className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"
          >
            <CheckIcon className="size-3.5" strokeWidth={4} />
          </span>
        ) : (
          <span aria-hidden="true" className={`size-5 shrink-0 rounded-full ${colors.fill}`} />
        )}
        <TaskIcon icon={chore.icon} className={`size-10 ${done ? 'opacity-60' : ''}`} />
        <span
          className={`min-w-0 text-lg leading-tight font-bold break-words ${done ? 'text-slate-500 line-through' : 'text-slate-800'}`}
        >
          {chore.title}
        </span>
      </button>
    </li>
  )
}
