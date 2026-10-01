import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import BroomIcon from '~icons/fluent-emoji-flat/broom'
import GoodIcon from '~icons/fluent-emoji-flat/check-mark-button'

import type { Chore, ChorePlan, Todo } from '../../api/chores'
import type { Member } from '../../api/members'
import { careShares } from '../../care'
import { LEVEL_COLORS, byUrgency, groupByLevel } from '../../chores'
import { errorMessage } from '../../errors'
import { ChoreCard } from '../chores/ChoreCard'
import { ChoreShare } from '../chores/ChoreShare'
import { TodoCard } from '../chores/TodoCard'
import type { ChoreDone } from '../chores/useChoreDone'

/** Rundes Symbol für den Haushalt, so groß wie ein Avatar. */
export function HouseholdAvatar({ label }: { label?: string }) {
  return (
    <span
      className="inline-flex size-20 shrink-0 items-center justify-center rounded-full bg-orange-200 ring-2 ring-white"
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      <BroomIcon className="size-12" aria-hidden="true" />
    </span>
  )
}

/**
 * Der Haushalt als Spalte neben den Kindern: was offen in „Zu erledigen“ steht und was im
 * Putzplan rot und gelb ist, zum Abhaken wie eine Aufgabe. Darüber, wo bei den Kindern Sterne und
 * Punkte stehen, die Ampel in Zahlen und die faire Verteilung. Grünes steht nur in der Ansicht
 * „Haushalt“.
 */
export function HouseholdColumn({
  plan,
  members,
  done,
  className,
}: {
  plan: ChorePlan
  members: Member[]
  done: ChoreDone
  className: string
}) {
  const { t } = useTranslation()
  const chores = plan.chores.filter((chore) => chore.active)
  const groups = groupByLevel(chores)
  const finished = chores.filter((chore) => chore.done_today).sort(byUrgency)
  const openTodos = plan.todos.filter((todo) => !todo.done)
  const doneTodos = plan.todos.filter((todo) => todo.done)
  const shares = careShares(members, plan.shares)

  const card = (chore: Chore) => (
    <ChoreCard
      key={chore.id}
      chore={chore}
      room={plan.rooms.find((room) => room.id === chore.room_id)}
      doneBy={members.find((member) => member.id === chore.done_by)}
      onToggle={() => done.toggle(chore)}
    />
  )

  const todoCard = (todo: Todo) => (
    <TodoCard
      key={todo.id}
      todo={todo}
      doneBy={members.find((member) => member.id === todo.done_by)}
      onToggle={() => done.toggleTodo(todo)}
    />
  )

  return (
    <section
      aria-label={t('chores.title')}
      className={`w-full shrink-0 snap-start flex-col gap-4 sm:w-80 lg:max-w-xl lg:min-w-80 lg:flex-1 lg:basis-0 ${className}`}
    >
      <Link
        to="/household"
        aria-label={t('home.open_chores')}
        className="flex flex-col items-center gap-1 rounded-3xl p-1 focus-visible:outline-4 focus-visible:outline-orange-400"
      >
        <HouseholdAvatar />
        <span className="w-full truncate text-center text-xl font-extrabold text-slate-800">
          {t('chores.title')}
        </span>
      </Link>
      {/* Gleiche Zeilenhöhen wie DayProgress, damit die Listen aller Spalten auf einer Höhe beginnen. */}
      <div className="grid w-full grid-rows-[1.75rem_3.25rem] justify-items-center gap-2">
        <p className="flex items-center gap-4 text-xl font-extrabold text-slate-700 tabular-nums">
          {(['due', 'soon'] as const).map((level) => (
            <span key={level} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={`size-5 rounded-full ${LEVEL_COLORS[level].fill}`}
              />
              <span className="sr-only">{t(`chores.level_${level}`)}:</span>
              {groups[level].length}
            </span>
          ))}
        </p>
        {shares ? (
          <ChoreShare shares={shares} days={plan.share_days} compact />
        ) : (
          <span aria-hidden="true" />
        )}
      </div>
      {done.error ? (
        <p role="alert" className="px-2 text-base font-semibold text-red-700">
          {errorMessage(t, done.error)}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        {openTodos.length > 0 && (
          <section aria-label={t('todos.title')} className="flex flex-col gap-2 px-1">
            <h3 className="flex min-h-9 items-center text-lg font-extrabold text-slate-700">
              {t('todos.title')}
            </h3>
            <ul className="flex flex-col gap-2">{openTodos.map(todoCard)}</ul>
          </section>
        )}
        {groups.due.length === 0 && groups.soon.length === 0 && openTodos.length === 0 && (
          <p className="flex flex-col items-center gap-3 py-8 text-center text-2xl font-bold text-slate-600">
            <GoodIcon className="size-24" aria-hidden="true" />
            {t('home.chores_all_good')}
          </p>
        )}
        {(['due', 'soon'] as const).map(
          (level) =>
            groups[level].length > 0 && (
              <section
                key={level}
                aria-label={t(`chores.level_${level}`)}
                className="flex flex-col gap-2 px-1"
              >
                <h3 className="flex min-h-9 items-center gap-3 text-lg font-extrabold text-slate-700">
                  <span
                    aria-hidden="true"
                    className={`mx-2 size-5 shrink-0 rounded-full ${LEVEL_COLORS[level].fill}`}
                  />
                  {t(`chores.level_${level}`)}
                </h3>
                <ul className="flex flex-col gap-2">{groups[level].map(card)}</ul>
              </section>
            ),
        )}
        {finished.length + doneTodos.length > 0 && (
          <section aria-label={t('chores.done_title')} className="flex flex-col gap-2 px-1">
            <h3 className="flex min-h-9 items-center text-lg font-extrabold text-slate-500">
              {t('chores.done_title')}
            </h3>
            <ul className="flex flex-col gap-2">
              {doneTodos.map(todoCard)}
              {finished.map(card)}
            </ul>
          </section>
        )}
      </div>
    </section>
  )
}
