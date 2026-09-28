import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import StarIcon from '~icons/fluent-emoji-flat/star'
import DownIcon from '~icons/lucide/arrow-down'
import UpIcon from '~icons/lucide/arrow-up'
import PlusIcon from '~icons/lucide/plus'

import type { Member } from '../../api/members'
import {
  TIMES_OF_DAY,
  type Task,
  type TimeOfDay,
  sortForMember,
  useSetTaskOrder,
} from '../../api/tasks'
import { Avatar } from '../../components/Avatar'
import { TaskIcon } from '../../components/TaskIcon'
import { TIME_OF_DAY_ICONS } from '../../components/TimeOfDayIcon'
import { Alert, Button, Section } from '../../components/ui'
import { errorMessage } from '../../errors'
import { occursOn, recurrenceSummary } from '../../recurrence'
import { addDays, isoWeekday, todayIn, weekdayName, weekdayOrder } from '../../weekdays'
import { FilterChip } from './formParts'

/** Diese Routinen stehen immer da, „Mittags“ nur, wenn das Kind dort etwas hat. */
const ALWAYS_SHOWN: readonly TimeOfDay[] = ['morning', 'afternoon', 'evening']

interface RoutinesSectionProps {
  /** Nur Kinder; Routinen sind für sie gedacht. */
  childMembers: Member[]
  tasks: Task[] | undefined
  error: unknown
  /** Ausgewähltes Kind. */
  member: Member | undefined
  onSelect: (memberId: number) => void
  onEdit: (task: Task) => void
  onAdd: (member: Member, timeOfDay: TimeOfDay) => void
  /** Zeitzone der Familie, für „heute“ in der Tagesauswahl. */
  timeZone: string
}

/** Routinen je Kind: Tagesabschnitte als Blöcke, Schritte in der Reihenfolge am Display. */
export function RoutinesSection({
  childMembers,
  tasks,
  error,
  member,
  onSelect,
  onEdit,
  onAdd,
  timeZone,
}: RoutinesSectionProps) {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language
  const setOrder = useSetTaskOrder()
  const today = todayIn(timeZone)
  const [day, setDay] = useState(today)

  if (childMembers.length === 0 || !member) {
    return (
      <Section title={t('routines.section')}>
        <p className="text-lg text-slate-600">{t('routines.need_children')}</p>
      </Section>
    )
  }

  // Die nächsten sieben Tage, als Wochentage in der Reihenfolge der Sprache (Mo … So).
  const week = Array.from({ length: 7 }, (_, offset) => addDays(today, offset))
  const days = weekdayOrder(language).map((weekday) =>
    week.find((date) => isoWeekday(date) === weekday)!,
  )
  const selectedDay = week.includes(day) ? day : today

  // Alle Routinenschritte des Kindes in seiner Reihenfolge, unabhängig vom Tag.
  const own = sortForMember(
    (tasks ?? []).filter(
      (task) => task.member_ids.includes(member.id) && !task.extra && task.time_of_day !== null,
    ),
    member.id,
  )
  const blocks = TIMES_OF_DAY.filter(
    (time) => ALWAYS_SHOWN.includes(time) || own.some((task) => task.time_of_day === time),
  )

  /** Tauscht einen Schritt mit seinem Nachbarn am gewählten Tag, alle anderen bleiben, wo sie sind. */
  const swap = (a: Task, b: Task) => {
    const ids = sortForMember(
      (tasks ?? []).filter((task) => task.member_ids.includes(member.id)),
      member.id,
    ).map((task) => task.id)
    const from = ids.indexOf(a.id)
    const to = ids.indexOf(b.id)
    ;[ids[from], ids[to]] = [ids[to], ids[from]]
    setOrder.mutate({ memberId: member.id, taskIds: ids })
  }

  return (
    <Section title={t('routines.section')}>
      {error ? <Alert>{errorMessage(t, error)}</Alert> : null}
      {setOrder.isError && <Alert>{errorMessage(t, setOrder.error)}</Alert>}
      <p className="text-lg text-slate-600">{t('routines.intro')}</p>

      {childMembers.length > 1 && (
        <div
          role="group"
          aria-label={t('routines.choose_child')}
          className="-mx-1 flex gap-2 overflow-x-auto px-1 py-1"
        >
          {childMembers.map((child) => (
            <FilterChip
              key={child.id}
              pressed={child.id === member.id}
              onClick={() => onSelect(child.id)}
            >
              <Avatar name={child.name} color={child.color} src={child.avatar_url} size="sm" />
              {child.name}
            </FilterChip>
          ))}
        </div>
      )}

      <div role="group" aria-label={t('routines.choose_day')} className="grid grid-cols-7 gap-1">
        {days.map((date) => {
          const weekday = isoWeekday(date)
          const isToday = date === today
          const long = weekdayName(language, weekday, 'long')
          return (
            <button
              key={date}
              type="button"
              aria-pressed={date === selectedDay}
              aria-label={isToday ? t('routines.day_today', { day: long }) : long}
              onClick={() => setDay(date)}
              className="flex min-h-14 flex-col items-center justify-center rounded-2xl text-lg font-bold text-slate-700 ring-2 ring-slate-200 focus-visible:outline-4 focus-visible:outline-orange-400 aria-pressed:bg-orange-500 aria-pressed:text-white aria-pressed:ring-orange-500"
            >
              {weekdayName(language, weekday, 'short')}
              {isToday && (
                <span aria-hidden="true" className="text-xs font-semibold">
                  {t('routines.today')}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {blocks.map((time) => (
        <RoutineBlock
          key={time}
          time={time}
          steps={own.filter(
            (task) => task.time_of_day === time && occursOn(task.recurrence, selectedDay),
          )}
          language={language}
          onEdit={onEdit}
          onAdd={() => onAdd(member, time)}
          onSwap={swap}
          disabled={tasks === undefined}
        />
      ))}
    </Section>
  )
}

function RoutineBlock({
  time,
  steps,
  language,
  onEdit,
  onAdd,
  onSwap,
  disabled,
}: {
  time: TimeOfDay
  steps: Task[]
  language: string
  onEdit: (task: Task) => void
  onAdd: () => void
  onSwap: (a: Task, b: Task) => void
  disabled: boolean
}) {
  const { t } = useTranslation()
  const Icon = TIME_OF_DAY_ICONS[time]
  const label = t(`times_of_day.${time}`)
  const counted = steps.filter((task) => task.active)
  const points = counted.reduce((sum, task) => sum + task.points, 0)

  return (
    <section
      aria-label={label}
      className="flex flex-col gap-3 rounded-3xl border-2 border-slate-100 bg-slate-50/60 p-3 sm:p-4"
    >
      <h3 className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xl font-extrabold text-slate-700">
        <Icon className="size-10 shrink-0" aria-hidden="true" />
        <span className="flex-1">{label}</span>
        {counted.length > 0 && (
          <span className="flex items-center gap-3 text-base font-bold text-slate-600">
            {t('routines.steps_count', { count: counted.length })}
            <span className="inline-flex items-center gap-1">
              <StarIcon className="size-6" aria-hidden="true" />
              <span aria-hidden="true">{points}</span>
              <span className="sr-only">{t('tasks.points_count', { count: points })}</span>
            </span>
          </span>
        )}
      </h3>

      {steps.length === 0 ? (
        <p className="text-lg text-slate-500">{t('routines.empty_block')}</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {steps.map((task, index) => (
            <RoutineStep
              key={task.id}
              task={task}
              number={index + 1}
              language={language}
              onEdit={() => onEdit(task)}
              onUp={index > 0 ? () => onSwap(task, steps[index - 1]) : undefined}
              onDown={index < steps.length - 1 ? () => onSwap(task, steps[index + 1]) : undefined}
            />
          ))}
        </ol>
      )}

      <Button variant="secondary" className="self-start" onClick={onAdd} disabled={disabled}>
        <PlusIcon className="size-6" aria-hidden="true" />
        {t('routines.add_step')}
      </Button>
    </section>
  )
}

function RoutineStep({
  task,
  number,
  language,
  onEdit,
  onUp,
  onDown,
}: {
  task: Task
  number: number
  language: string
  onEdit: () => void
  onUp?: () => void
  onDown?: () => void
}) {
  const { t } = useTranslation()
  const arrow =
    'flex size-12 items-center justify-center rounded-xl bg-slate-100 text-slate-700 hover:bg-orange-100 focus-visible:outline-4 focus-visible:outline-orange-400 disabled:opacity-30'

  return (
    <li
      className={`flex items-center gap-2 rounded-2xl bg-white p-2 sm:gap-3 ${task.active ? '' : 'opacity-60'}`}
    >
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-orange-100 text-lg font-extrabold text-orange-700 tabular-nums"
      >
        {number}
      </span>
      <button
        type="button"
        onClick={onEdit}
        aria-label={t('tasks.edit_title', { title: task.title })}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 text-left transition-colors hover:bg-orange-50 focus-visible:outline-4 focus-visible:outline-orange-400 active:bg-orange-100"
      >
        <TaskIcon icon={task.icon} className="size-14 shrink-0" />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-lg font-bold break-words text-slate-800">
            {task.title}
            {!task.active && (
              <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-sm font-bold text-slate-600">
                {t('tasks.inactive')}
              </span>
            )}
          </span>
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-base text-slate-600">
            {task.recurrence.kind !== 'daily' && (
              <span>{recurrenceSummary(t, language, task.recurrence)}</span>
            )}
            <span className="inline-flex items-center gap-1 font-bold text-slate-700">
              <StarIcon className="size-6" aria-hidden="true" />
              <span aria-hidden="true">{task.points}</span>
              <span className="sr-only">{t('tasks.points_count', { count: task.points })}</span>
            </span>
          </span>
        </span>
      </button>
      <span className="flex shrink-0 flex-col gap-1">
        <button
          type="button"
          onClick={onUp}
          disabled={!onUp}
          aria-label={t('tasks.move_up', { title: task.title })}
          className={arrow}
        >
          <UpIcon className="size-6" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onDown}
          disabled={!onDown}
          aria-label={t('tasks.move_down', { title: task.title })}
          className={arrow}
        >
          <DownIcon className="size-6" aria-hidden="true" />
        </button>
      </span>
    </li>
  )
}
