import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import StarIcon from '~icons/fluent-emoji-flat/star'
import TrashIcon from '~icons/fluent-emoji-flat/wastebasket'
import DownIcon from '~icons/lucide/arrow-down'
import UpIcon from '~icons/lucide/arrow-up'
import CopyIcon from '~icons/lucide/copy'
import PlusIcon from '~icons/lucide/plus'
import RemoveIcon from '~icons/lucide/x'

import type { Member } from '../../api/members'
import {
  type Routine,
  type RoutineStep,
  useAddRoutineStep,
  useCreateRoutine,
  useDeleteRoutine,
  useSetRoutineDays,
  useSetRoutineSteps,
} from '../../api/routines'
import { TIMES_OF_DAY, type Task, type TimeOfDay } from '../../api/tasks'
import { Avatar } from '../../components/Avatar'
import { TaskIcon } from '../../components/TaskIcon'
import { TIME_OF_DAY_ICONS } from '../../components/TimeOfDayIcon'
import { Alert, Button, Section } from '../../components/ui'
import { errorMessage } from '../../errors'
import { recurrenceSummary } from '../../recurrence'
import { WEEKEND, weekdayName, weekdayOrder } from '../../weekdays'
import { ChildPicker, FilterChip } from './formParts'

/** Diese Abschnitte stehen immer da, „Mittags“ nur, wenn das Kind dort eine Routine hat. */
const ALWAYS_SHOWN: readonly TimeOfDay[] = ['morning', 'afternoon', 'evening']
const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7]

type T = ReturnType<typeof useTranslation>['t']

/** „Montag bis Freitag“, „Am Wochenende“, „Täglich“ oder „An keinem Tag“. */
function daysLabel(t: T, language: string, weekdays: number[]) {
  return weekdays.length === 0
    ? t('routines.no_days')
    : recurrenceSummary(t, language, { kind: 'weekly', weekdays })
}

/** z. B. „Lena · Morgens · Montag bis Freitag“. */
function routineLabel(t: T, language: string, routine: Routine, member: Member) {
  return t('routines.label', {
    name: member.name,
    time: t(`times_of_day.${routine.time_of_day}`),
    days: daysLabel(t, language, routine.weekdays),
  })
}

interface RoutinesSectionProps {
  /** Nur Kinder; Routinen sind für sie gedacht. */
  childMembers: Member[]
  tasks: Task[] | undefined
  routines: Routine[] | undefined
  error: unknown
  /** Ausgewähltes Kind. */
  member: Member | undefined
  onSelect: (memberId: number) => void
  onEditTask: (task: Task) => void
  /** Neuer Schritt: öffnet den Aufgaben-Editor für diese Routine. */
  onNewStep: (routine: Routine, label: string) => void
  onMessage: (message: string) => void
}

/** Routinen je Kind: Tagesabschnitte als Blöcke, darin Versionen für verschiedene Wochentage. */
export function RoutinesSection({
  childMembers,
  tasks,
  routines,
  error,
  member,
  onSelect,
  onEditTask,
  onNewStep,
  onMessage,
}: RoutinesSectionProps) {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language
  const create = useCreateRoutine()

  if (childMembers.length === 0 || !member) {
    return (
      <Section title={t('routines.section')}>
        <p className="text-lg text-slate-600">{t('routines.need_children')}</p>
      </Section>
    )
  }

  const own = (routines ?? []).filter((routine) => routine.member_id === member.id)
  const times = TIMES_OF_DAY.filter(
    (time) => ALWAYS_SHOWN.includes(time) || own.some((routine) => routine.time_of_day === time),
  )

  return (
    <Section title={t('routines.section')}>
      {error ? <Alert>{errorMessage(t, error)}</Alert> : null}
      {create.isError && <Alert>{errorMessage(t, create.error)}</Alert>}
      <p className="text-lg text-slate-600">{t('routines.intro')}</p>
      <ChildPicker
        label={t('routines.choose_child')}
        childMembers={childMembers}
        selected={member}
        onSelect={onSelect}
      />

      {routines !== undefined &&
        tasks !== undefined &&
        times.map((time) => {
          const variants = own
            .filter((routine) => routine.time_of_day === time)
            .sort((a, b) => (a.weekdays[0] ?? 8) - (b.weekdays[0] ?? 8) || a.id - b.id)
          const covered = new Set(variants.flatMap((routine) => routine.weekdays))
          const uncovered = weekdayOrder(language).filter((day) => !covered.has(day))
          const Icon = TIME_OF_DAY_ICONS[time]
          const label = t(`times_of_day.${time}`)

          /** Neue Version: bisher freie Tage, sonst das Wochenende; Schritte als Vorlage. */
          const addVariant = () => {
            const free = ALL_DAYS.filter((day) => !covered.has(day))
            create.mutate({
              member_id: member.id,
              time_of_day: time,
              weekdays: free.length > 0 ? free : WEEKEND,
              copy_from: variants[0]?.id,
            })
          }

          return (
            <section
              key={time}
              aria-label={label}
              className="flex flex-col gap-3 rounded-3xl border-2 border-slate-100 bg-slate-50/60 p-3 sm:p-4"
            >
              <h3 className="flex items-center gap-3 text-xl font-extrabold text-slate-700">
                <Icon className="size-10 shrink-0" aria-hidden="true" />
                {label}
              </h3>

              {variants.length === 0 ? (
                <>
                  <p className="text-lg text-slate-500">{t('routines.none_yet')}</p>
                  <Button
                    variant="secondary"
                    className="self-start"
                    disabled={create.isPending}
                    onClick={() =>
                      create.mutate({ member_id: member.id, time_of_day: time, weekdays: ALL_DAYS })
                    }
                  >
                    <PlusIcon className="size-6" aria-hidden="true" />
                    {t('routines.create')}
                  </Button>
                </>
              ) : (
                <>
                  {variants.map((routine) => (
                    <VariantCard
                      key={routine.id}
                      routine={routine}
                      member={member}
                      childMembers={childMembers}
                      tasks={tasks}
                      language={language}
                      onEditTask={onEditTask}
                      onNewStep={onNewStep}
                      onMessage={onMessage}
                    />
                  ))}
                  {uncovered.length > 0 && (
                    <p className="text-base text-slate-500">
                      {t('routines.uncovered', {
                        days: new Intl.ListFormat(language, { type: 'conjunction' }).format(
                          uncovered.map((day) => weekdayName(language, day, 'short')),
                        ),
                      })}
                    </p>
                  )}
                  <Button
                    variant="secondary"
                    className="self-start"
                    disabled={create.isPending}
                    onClick={addVariant}
                  >
                    <PlusIcon className="size-6" aria-hidden="true" />
                    {t('routines.add_variant')}
                  </Button>
                </>
              )}
            </section>
          )
        })}
    </Section>
  )
}

function VariantCard({
  routine,
  member,
  childMembers,
  tasks,
  language,
  onEditTask,
  onNewStep,
  onMessage,
}: {
  routine: Routine
  member: Member
  childMembers: Member[]
  tasks: Task[]
  language: string
  onEditTask: (task: Task) => void
  onNewStep: (routine: Routine, label: string) => void
  onMessage: (message: string) => void
}) {
  const { t } = useTranslation()
  const setDays = useSetRoutineDays()
  const setSteps = useSetRoutineSteps()
  const addStep = useAddRoutineStep()
  const copy = useCreateRoutine()
  const remove = useDeleteRoutine()
  const [panel, setPanel] = useState<'add' | 'copy' | 'delete' | null>(null)

  const byId = new Map(tasks.map((task) => [task.id, task]))
  const steps = routine.steps.flatMap((step) => {
    const task = byId.get(step.task_id)
    return task ? [{ step, task }] : []
  })
  const counted = steps.filter(({ step, task }) => task.active && !step.optional)
  const points = counted.reduce((sum, { task }) => sum + task.points, 0)
  const label = routineLabel(t, language, routine, member)
  const days = daysLabel(t, language, routine.weekdays)
  const error = setDays.error ?? setSteps.error ?? addStep.error ?? copy.error ?? remove.error

  const save = (next: RoutineStep[]) => setSteps.mutate({ id: routine.id, steps: next })
  const move = (index: number, direction: -1 | 1) => {
    const next = [...routine.steps]
    ;[next[index], next[index + direction]] = [next[index + direction], next[index]]
    save(next)
  }
  const toggleDay = (day: number) =>
    setDays.mutate({
      id: routine.id,
      weekdays: routine.weekdays.includes(day)
        ? routine.weekdays.filter((candidate) => candidate !== day)
        : [...routine.weekdays, day].sort(),
    })

  // Vorhandene Schritte zum Übernehmen: gleicher Tagesabschnitt, aus Routinen oder von diesem Kind.
  const inRoutine = new Set(routine.steps.map((step) => step.task_id))
  const candidates = tasks
    .filter(
      (task) =>
        task.time_of_day === routine.time_of_day &&
        !task.extra &&
        !inRoutine.has(task.id) &&
        (task.routine_member_ids.length > 0 || task.member_ids.includes(member.id)),
    )
    .sort((a, b) => a.title.localeCompare(b.title, language))
  const otherChildren = childMembers.filter((child) => child.id !== member.id)

  return (
    <article aria-label={days} className="flex flex-col gap-3 rounded-2xl bg-white p-3 shadow-sm">
      {error ? <Alert>{errorMessage(t, error)}</Alert> : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-lg font-extrabold text-slate-700">{days}</h4>
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
      </div>

      <div
        role="group"
        aria-label={t('routines.days_group', { routine: label })}
        className="grid grid-cols-7 gap-1"
      >
        {weekdayOrder(language).map((day) => (
          <button
            key={day}
            type="button"
            aria-pressed={routine.weekdays.includes(day)}
            aria-label={weekdayName(language, day, 'long')}
            onClick={() => toggleDay(day)}
            disabled={setDays.isPending}
            className="flex min-h-12 items-center justify-center rounded-xl text-base font-bold text-slate-600 ring-2 ring-slate-200 focus-visible:outline-4 focus-visible:outline-orange-400 aria-pressed:bg-orange-500 aria-pressed:text-white aria-pressed:ring-orange-500"
          >
            {weekdayName(language, day, 'short')}
          </button>
        ))}
      </div>

      {steps.length === 0 ? (
        <p className="text-lg text-slate-500">{t('routines.empty_block')}</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {steps.map(({ step, task }, index) => (
            <StepRow
              key={task.id}
              task={task}
              step={step}
              number={index + 1}
              onEdit={() => onEditTask(task)}
              onUp={index > 0 ? () => move(index, -1) : undefined}
              onDown={index < steps.length - 1 ? () => move(index, 1) : undefined}
              onToggleOptional={() =>
                save(
                  routine.steps.map((candidate) =>
                    candidate.task_id === task.id
                      ? { ...candidate, optional: !candidate.optional }
                      : candidate,
                  ),
                )
              }
              onRemove={() =>
                save(routine.steps.filter((candidate) => candidate.task_id !== task.id))
              }
            />
          ))}
        </ol>
      )}

      {panel === 'add' && (
        <div className="flex flex-col gap-3 rounded-2xl bg-orange-50 p-3">
          <Button className="self-start" onClick={() => onNewStep(routine, label)}>
            <PlusIcon className="size-6" aria-hidden="true" />
            {t('routines.new_step')}
          </Button>
          {candidates.length > 0 && (
            <>
              <p className="text-lg text-slate-700">{t('routines.pick_existing')}</p>
              <ul className="flex flex-wrap gap-2">
                {candidates.map((task) => (
                  <li key={task.id}>
                    <button
                      type="button"
                      disabled={addStep.isPending}
                      onClick={() =>
                        addStep.mutate(
                          { id: routine.id, step: { task_id: task.id } },
                          { onSuccess: () => setPanel(null) },
                        )
                      }
                      className="flex min-h-14 items-center gap-2 rounded-2xl bg-white py-1 pr-4 pl-2 text-lg font-bold text-slate-700 ring-2 ring-slate-200 hover:bg-orange-100 focus-visible:outline-4 focus-visible:outline-orange-400"
                    >
                      <TaskIcon icon={task.icon} className="size-10" />
                      {task.title}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <Button variant="secondary" className="self-start" onClick={() => setPanel(null)}>
            {t('actions.cancel')}
          </Button>
        </div>
      )}

      {panel === 'copy' && (
        <div className="flex flex-col gap-3 rounded-2xl bg-orange-50 p-3">
          <p className="text-lg text-slate-700">{t('routines.copy_hint', { days })}</p>
          <div className="flex flex-wrap gap-2">
            {otherChildren.map((child) => (
              <FilterChip
                key={child.id}
                pressed={false}
                onClick={() =>
                  copy.mutate(
                    {
                      member_id: child.id,
                      time_of_day: routine.time_of_day,
                      weekdays: routine.weekdays,
                      copy_from: routine.id,
                    },
                    {
                      onSuccess: () => {
                        setPanel(null)
                        onMessage(t('routines.copied', { routine: label, name: child.name }))
                      },
                    },
                  )
                }
              >
                <Avatar name={child.name} color={child.color} src={child.avatar_url} size="sm" />
                {child.name}
              </FilterChip>
            ))}
          </div>
          <Button variant="secondary" className="self-start" onClick={() => setPanel(null)}>
            {t('actions.cancel')}
          </Button>
        </div>
      )}

      {panel === 'delete' && (
        <div className="flex flex-col gap-3 rounded-2xl bg-red-50 p-3">
          <p className="text-lg font-semibold text-red-800">
            {t('routines.delete_confirm', { routine: label })}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="danger"
              disabled={remove.isPending}
              onClick={() => remove.mutate(routine.id)}
            >
              {t('routines.delete')}
            </Button>
            <Button variant="secondary" onClick={() => setPanel(null)}>
              {t('actions.cancel')}
            </Button>
          </div>
        </div>
      )}

      {panel === null && (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setPanel('add')}>
            <PlusIcon className="size-6" aria-hidden="true" />
            {t('routines.add_step')}
          </Button>
          {otherChildren.length > 0 && (
            <Button variant="secondary" onClick={() => setPanel('copy')}>
              <CopyIcon className="size-6" aria-hidden="true" />
              {t('routines.copy')}
            </Button>
          )}
          <Button variant="secondary" onClick={() => setPanel('delete')}>
            <TrashIcon className="size-6" aria-hidden="true" />
            {t('routines.delete')}
          </Button>
        </div>
      )}
    </article>
  )
}

function StepRow({
  task,
  step,
  number,
  onEdit,
  onUp,
  onDown,
  onToggleOptional,
  onRemove,
}: {
  task: Task
  step: RoutineStep
  number: number
  onEdit: () => void
  onUp?: () => void
  onDown?: () => void
  onToggleOptional: () => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const square =
    'flex size-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 hover:bg-orange-100 focus-visible:outline-4 focus-visible:outline-orange-400 disabled:opacity-30'

  return (
    <li
      className={`flex flex-wrap items-center gap-2 rounded-2xl border-2 p-2 sm:flex-nowrap ${step.optional ? 'border-dashed border-slate-300' : 'border-slate-100'} ${task.active ? '' : 'opacity-60'}`}
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
        <TaskIcon icon={task.icon} className="size-12 shrink-0" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-lg font-bold break-words text-slate-800">
            {task.title}
            {!task.active && (
              <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-sm font-bold text-slate-600">
                {t('tasks.inactive')}
              </span>
            )}
          </span>
          <span className="inline-flex items-center gap-1 text-base font-bold text-slate-600">
            <StarIcon className="size-5" aria-hidden="true" />
            <span aria-hidden="true">{task.points}</span>
            <span className="sr-only">{t('tasks.points_count', { count: task.points })}</span>
          </span>
        </span>
      </button>
      <span className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          aria-pressed={step.optional}
          aria-label={t('routines.optional_toggle', { title: task.title })}
          onClick={onToggleOptional}
          className="min-h-12 rounded-xl px-3 text-base font-bold text-slate-600 ring-2 ring-slate-200 focus-visible:outline-4 focus-visible:outline-orange-400 aria-pressed:bg-slate-700 aria-pressed:text-white aria-pressed:ring-slate-700"
        >
          {t('routines.optional')}
        </button>
        <button
          type="button"
          onClick={onUp}
          disabled={!onUp}
          aria-label={t('tasks.move_up', { title: task.title })}
          className={square}
        >
          <UpIcon className="size-6" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onDown}
          disabled={!onDown}
          aria-label={t('tasks.move_down', { title: task.title })}
          className={square}
        >
          <DownIcon className="size-6" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={t('routines.remove_step', { title: task.title })}
          className={square}
        >
          <RemoveIcon className="size-6" aria-hidden="true" />
        </button>
      </span>
    </li>
  )
}
