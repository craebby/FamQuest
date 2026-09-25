import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import CalendarIcon from '~icons/fluent-emoji-flat/spiral-calendar'
import OnceIcon from '~icons/fluent-emoji-flat/tear-off-calendar'
import StarIcon from '~icons/fluent-emoji-flat/star'
import ListIcon from '~icons/fluent-emoji-flat/clipboard'
import TrashIcon from '~icons/fluent-emoji-flat/wastebasket'
import DailyIcon from '~icons/fluent-emoji-flat/repeat-button'
import FlexibleIcon from '~icons/fluent-emoji-flat/shuffle-tracks-button'
import AnytimeIcon from '~icons/fluent-emoji-flat/infinity'
import ExtraIcon from '~icons/fluent-emoji-flat/flexed-biceps'
import CheckIcon from '~icons/lucide/check'

import { ApiError } from '../../api/client'
import type { Member } from '../../api/members'
import {
  type RecurrenceKind,
  MAX_INTERVAL_DAYS,
  TASK_MAX_POINTS,
  TIMES_OF_DAY,
  type Task,
  type TaskData,
  type TimeOfDay,
  createTask,
  deleteTask,
  updateTask,
  useTasksMutation,
} from '../../api/tasks'
import { Avatar } from '../../components/Avatar'
import { TaskIcon } from '../../components/TaskIcon'
import { TIME_OF_DAY_ICONS } from '../../components/TimeOfDayIcon'
import { Alert, Button, Switch, TextAreaField, TextField } from '../../components/ui'
import { errorMessage } from '../../errors'
import { DEFAULT_TASK_ICON, iconLabel, iconName, suggestIcon } from '../../icons/catalog'
import { COLOR_TOKENS, MEMBER_COLORS, type MemberColor } from '../../memberColors'
import { WEEKEND, WORKDAYS, sameDays, todayIn, weekdayName, weekdayOrder } from '../../weekdays'
import { type TaskTemplate, taskTemplateIcon } from '../../pools/tasks'
import { IconPicker } from './IconPicker'
import { TaskTemplatePicker } from './TaskTemplatePicker'
import { ChoiceTile, Field, NumberStepper } from './formParts'
import { intervalLabel } from '../../recurrence'

const KIND_ICONS: Record<RecurrenceKind, typeof DailyIcon> = {
  daily: DailyIcon,
  weekly: CalendarIcon,
  once: OnceIcon,
  flexible: FlexibleIcon,
}

/** Schnellwahl für flexible Aufgaben, in Tagen. */
const INTERVAL_PRESETS = [2, 7, 14, 30]

/** Farbverlauf aller Personenfarben als Symbol für „Farbe der jeweiligen Person“. */
const MEMBER_COLOR_GRADIENT = `conic-gradient(${MEMBER_COLORS.map((color) => COLOR_TOKENS[color].main).join(', ')}, ${COLOR_TOKENS[MEMBER_COLORS[0]].main})`

interface TaskEditorProps {
  /** Ohne `task` wird eine neue Aufgabe angelegt. */
  task?: Task
  members: Member[]
  /** Vorauswahl der Personen bei neuen Aufgaben (z. B. aus dem Filter der Liste). */
  initialMemberIds?: number[]
  /** Zeitzone der Familie, für das Standarddatum bei „Einmal“. */
  timeZone: string
  onSaved: (title: string) => void
  onDeleted: (title: string) => void
  onCancel: () => void
}

export function TaskEditor({
  task,
  members,
  initialMemberIds = [],
  timeZone,
  onSaved,
  onDeleted,
  onCancel,
}: TaskEditorProps) {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language
  const recurrence = task?.recurrence

  const [title, setTitle] = useState(task?.title ?? '')
  // Bis Eltern selbst ein Symbol wählen, wird es aus dem Titel vorgeschlagen.
  const [chosenIcon, setChosenIcon] = useState<string | null>(task?.icon ?? null)
  const [points, setPoints] = useState(task?.points ?? 1)
  const [memberIds, setMemberIds] = useState<number[]>(task?.member_ids ?? initialMemberIds)
  const [kind, setKind] = useState<RecurrenceKind>(recurrence?.kind ?? 'daily')
  const [weekdays, setWeekdays] = useState<number[]>(
    recurrence?.kind === 'weekly' ? recurrence.weekdays : WORKDAYS,
  )
  const [date, setDate] = useState(
    recurrence?.kind === 'once' || recurrence?.kind === 'flexible'
      ? recurrence.date
      : todayIn(timeZone),
  )
  const [intervalDays, setIntervalDays] = useState(
    recurrence?.kind === 'flexible' ? recurrence.interval_days : 7,
  )
  const [shared, setShared] = useState(task?.shared ?? false)
  // Block der Aufgabe: ein Tagesabschnitt der Routine, „Jederzeit“ (null) oder „Extra“.
  const [block, setBlock] = useState<TimeOfDay | null | 'extra'>(
    task?.extra ? 'extra' : (task?.time_of_day ?? null),
  )
  const [color, setColor] = useState<MemberColor | null>(task?.color ?? null)
  const [description, setDescription] = useState(task?.description ?? '')
  const [active, setActive] = useState(task?.active ?? true)
  const [needsApproval, setNeedsApproval] = useState(task?.needs_approval ?? false)
  const [pickingIcon, setPickingIcon] = useState(false)
  const [pickingTemplate, setPickingTemplate] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const icon = chosenIcon ?? suggestIcon(title) ?? DEFAULT_TASK_ICON
  const save = useTasksMutation((data: TaskData) =>
    task ? updateTask(task.id, data) : createTask(data),
  )
  const remove = useTasksMutation((id: number) => deleteTask(id))

  const fieldError = (field: string) =>
    save.error instanceof ApiError && save.error.fields[field]
      ? errorMessage(t, save.error.fields[field])
      : undefined
  const titleError =
    submitted && !title.trim() ? errorMessage(t, 'validation.required') : fieldError('title')
  const membersError =
    submitted && memberIds.length === 0 ? errorMessage(t, 'validation.choose_member') : undefined
  const weekdaysError =
    submitted && kind === 'weekly' && weekdays.length === 0
      ? errorMessage(t, 'validation.choose_weekday')
      : undefined
  const dateError =
    submitted && (kind === 'once' || kind === 'flexible') && !date
      ? errorMessage(t, 'validation.required')
      : undefined

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    if (!title.trim() || memberIds.length === 0) return
    if (kind === 'weekly' && weekdays.length === 0) return
    if ((kind === 'once' || kind === 'flexible') && !date) return
    save.mutate(
      {
        title: title.trim(),
        icon,
        description: description.trim(),
        points,
        time_of_day: block === 'extra' ? null : block,
        extra: block === 'extra',
        color,
        active,
        needs_approval: needsApproval,
        // Bei nur einer Person hat „Einer für alle“ keine Wirkung.
        shared: shared && memberIds.length > 1,
        recurrence:
          kind === 'weekly'
            ? { kind, weekdays: [...weekdays].sort() }
            : kind === 'once'
              ? { kind, date }
              : kind === 'flexible'
                ? { kind, interval_days: intervalDays, date }
                : { kind },
        member_ids: memberIds,
      },
      { onSuccess: (saved) => onSaved(saved.title) },
    )
  }

  const toggle = (list: number[], value: number) =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
  const busy = save.isPending || remove.isPending

  const applyTemplate = (template: TaskTemplate, templateTitle: string) => {
    setTitle(templateTitle)
    setChosenIcon(taskTemplateIcon(template))
    setPoints(template.points)
    setBlock(template.extra ? 'extra' : template.time_of_day)
    setNeedsApproval(template.needs_approval ?? false)
    setShared(template.shared ?? false)
    setKind(template.recurrence.kind)
    if (template.recurrence.kind === 'weekly') setWeekdays(template.recurrence.weekdays)
    if (template.recurrence.kind === 'flexible') {
      setIntervalDays(template.recurrence.interval_days)
      setDate(todayIn(timeZone))
    }
    setPickingTemplate(false)
  }
  // Nur Erwachsene gewählt: Haushaltsvorlagen zuerst zeigen.
  const onlyAdults =
    memberIds.length > 0 &&
    memberIds.every((id) => members.find((member) => member.id === id)?.role === 'parent')
  const iconText = iconLabel(t, iconName(icon) ?? '')

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <h1 className="text-3xl font-extrabold break-words text-orange-600">
        {task ? t('tasks.edit_title', { title: task.title }) : t('tasks.new_title')}
      </h1>

      {!task && (
        <Button variant="secondary" className="self-start" onClick={() => setPickingTemplate(true)}>
          <ListIcon className="size-7" aria-hidden="true" />
          {t('tasks.from_template')}
        </Button>
      )}

      <form
        className="flex flex-col gap-6 rounded-3xl bg-white p-6 shadow-sm"
        onSubmit={submit}
        noValidate
      >
        {save.isError && !(save.error instanceof ApiError && save.error.fields.title) && (
          <Alert>{errorMessage(t, save.error)}</Alert>
        )}
        {remove.isError && <Alert>{errorMessage(t, remove.error)}</Alert>}

        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
          <div className="flex shrink-0 flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => setPickingIcon(true)}
              aria-label={`${t('tasks.change_icon')}: ${iconText}`}
              className="flex size-32 items-center justify-center rounded-3xl bg-orange-50 ring-2 ring-orange-200 transition-colors hover:bg-orange-100 focus-visible:outline-4 focus-visible:outline-orange-400"
            >
              <TaskIcon icon={icon} className="size-24" />
            </button>
            <button
              type="button"
              onClick={() => setPickingIcon(true)}
              aria-hidden="true"
              tabIndex={-1}
              className="min-h-12 px-2 text-base font-bold text-orange-700 underline-offset-4 hover:underline"
            >
              {t('tasks.change_icon')}
            </button>
          </div>
          <div className="w-full">
            <TextField
              label={t('tasks.title')}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={100}
              autoComplete="off"
              error={titleError}
            />
          </div>
        </div>

        <Field label={t('tasks.points')}>
          <NumberStepper
            label={t('tasks.points')}
            value={points}
            min={0}
            max={TASK_MAX_POINTS}
            onChange={setPoints}
            decreaseLabel={t('tasks.fewer_points')}
            increaseLabel={t('tasks.more_points')}
            icon={<StarIcon className="size-8 shrink-0" aria-hidden="true" />}
          />
        </Field>

        <div className="flex flex-col gap-1">
          <Switch
            checked={needsApproval}
            onChange={setNeedsApproval}
            label={t('tasks.needs_approval')}
            showLabel
          />
          <p className="text-base text-slate-500">{t('tasks.needs_approval_hint')}</p>
        </div>

        <Field label={t('tasks.members')} error={membersError}>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-3">
            {members.map((member) => (
              <label key={member.id} className="cursor-pointer">
                <input
                  type="checkbox"
                  checked={memberIds.includes(member.id)}
                  onChange={() => setMemberIds((ids) => toggle(ids, member.id))}
                  className="peer sr-only"
                />
                <span className="flex h-full flex-col items-center gap-2 rounded-2xl border-2 border-slate-200 p-3 text-center text-lg font-bold break-words text-slate-700 peer-checked:border-orange-500 peer-checked:bg-orange-50 peer-focus-visible:outline-4 peer-focus-visible:outline-orange-400">
                  <Avatar name={member.name} color={member.color} src={member.avatar_url} />
                  {member.name}
                </span>
              </label>
            ))}
          </div>
        </Field>

        {memberIds.length > 1 && (
          <div className="flex flex-col gap-1">
            <Switch checked={shared} onChange={setShared} label={t('tasks.shared')} showLabel />
            <p className="text-base text-slate-500">{t('tasks.shared_hint')}</p>
          </div>
        )}

        <Field label={t('tasks.recurrence')}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(['daily', 'weekly', 'flexible', 'once'] as const).map((value) => {
              const Icon = KIND_ICONS[value]
              return (
                <ChoiceTile
                  key={value}
                  name="recurrence"
                  checked={kind === value}
                  onChange={() => setKind(value)}
                >
                  <Icon className="size-10" aria-hidden="true" />
                  {t(`tasks.kind_${value}`)}
                </ChoiceTile>
              )
            })}
          </div>
        </Field>

        {kind === 'weekly' && (
          <Field label={t('tasks.weekdays')} error={weekdaysError}>
            <div className="flex flex-wrap gap-2">
              {weekdayOrder(language).map((day) => (
                <label key={day} className="cursor-pointer">
                  <input
                    type="checkbox"
                    checked={weekdays.includes(day)}
                    onChange={() => setWeekdays((days) => toggle(days, day))}
                    aria-label={weekdayName(language, day, 'long')}
                    className="peer sr-only"
                  />
                  <span className="flex size-16 items-center justify-center rounded-2xl border-2 border-slate-200 text-lg font-bold text-slate-700 peer-checked:border-orange-500 peer-checked:bg-orange-500 peer-checked:text-white peer-focus-visible:outline-4 peer-focus-visible:outline-orange-400">
                    {weekdayName(language, day, 'short')}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="secondary"
                aria-pressed={sameDays(weekdays, WORKDAYS)}
                onClick={() => setWeekdays(WORKDAYS)}
              >
                {t('tasks.workdays')}
              </Button>
              <Button
                variant="secondary"
                aria-pressed={sameDays(weekdays, WEEKEND)}
                onClick={() => setWeekdays(WEEKEND)}
              >
                {t('tasks.weekend')}
              </Button>
            </div>
          </Field>
        )}

        {kind === 'once' && (
          <TextField
            label={t('tasks.date')}
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            error={dateError}
          />
        )}

        {kind === 'flexible' && (
          <>
            <Field label={t('tasks.interval')}>
              <p className="-mt-1 text-base text-slate-500">{t('tasks.flexible_hint')}</p>
              <div className="flex flex-wrap gap-3">
                {INTERVAL_PRESETS.map((days) => (
                  <Button
                    key={days}
                    variant="secondary"
                    aria-pressed={intervalDays === days}
                    className="aria-pressed:bg-orange-500 aria-pressed:text-white aria-pressed:ring-orange-500"
                    onClick={() => setIntervalDays(days)}
                  >
                    {intervalLabel(t, days)}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <NumberStepper
                  label={t('tasks.interval_days')}
                  value={intervalDays}
                  min={1}
                  max={MAX_INTERVAL_DAYS}
                  onChange={setIntervalDays}
                  decreaseLabel={t('tasks.fewer_days')}
                  increaseLabel={t('tasks.more_days')}
                />
                <span className="text-lg font-bold text-slate-700">
                  {t('tasks.days', { count: intervalDays })}
                </span>
              </div>
            </Field>
            <TextField
              label={t('tasks.first_due')}
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              error={dateError}
            />
          </>
        )}

        <Field label={t('tasks.time_of_day')}>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-3">
            <ChoiceTile name="time_of_day" checked={block === null} onChange={() => setBlock(null)}>
              <AnytimeIcon className="size-10" aria-hidden="true" />
              {t('tasks.anytime')}
            </ChoiceTile>
            {TIMES_OF_DAY.map((value) => {
              const Icon = TIME_OF_DAY_ICONS[value]
              return (
                <ChoiceTile
                  key={value}
                  name="time_of_day"
                  checked={block === value}
                  onChange={() => setBlock(value)}
                >
                  <Icon className="size-10" aria-hidden="true" />
                  {t(`times_of_day.${value}`)}
                </ChoiceTile>
              )
            })}
            <ChoiceTile
              name="time_of_day"
              checked={block === 'extra'}
              onChange={() => setBlock('extra')}
            >
              <ExtraIcon className="size-10" aria-hidden="true" />
              {t('tasks.extra')}
            </ChoiceTile>
          </div>
          <p className="text-base text-slate-500">
            {t(block === 'extra' ? 'tasks.extra_hint' : 'tasks.routine_hint')}
          </p>
        </Field>

        <Field label={t('tasks.color')}>
          <div className="flex flex-wrap gap-3">
            <ColorOption
              label={t('tasks.color_member')}
              checked={color === null}
              onChange={() => setColor(null)}
              background={MEMBER_COLOR_GRADIENT}
            />
            {MEMBER_COLORS.map((value) => (
              <ColorOption
                key={value}
                label={t(`colors.${value}`)}
                checked={color === value}
                onChange={() => setColor(value)}
                background={COLOR_TOKENS[value].main}
                foreground={COLOR_TOKENS[value].onMain}
              />
            ))}
          </div>
        </Field>

        <TextAreaField
          label={t('tasks.description')}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={500}
        />

        <div className="flex flex-col gap-1">
          <Switch checked={active} onChange={setActive} label={t('tasks.active')} showLabel />
          <p className="text-base text-slate-500">{t('tasks.active_hint')}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={busy}>
            {t('tasks.save')}
          </Button>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            {t('actions.cancel')}
          </Button>
        </div>
      </form>

      {task &&
        (confirmDelete ? (
          <div className="flex flex-col gap-3 rounded-3xl bg-red-50 p-6">
            <p className="text-lg font-semibold text-red-800">
              {t('tasks.delete_confirm', { title: task.title })}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => remove.mutate(task.id, { onSuccess: () => onDeleted(task.title) })}
              >
                {t('tasks.delete')}
              </Button>
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                {t('actions.cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="danger" className="self-start" onClick={() => setConfirmDelete(true)}>
            <TrashIcon className="size-7" aria-hidden="true" />
            {t('tasks.delete')}
          </Button>
        ))}

      {pickingTemplate && (
        <TaskTemplatePicker
          initialGroup={onlyAdults ? 'household' : 'kids'}
          onSelect={applyTemplate}
          onClose={() => setPickingTemplate(false)}
        />
      )}

      {pickingIcon && (
        <IconPicker
          value={icon}
          onSelect={(value) => {
            setChosenIcon(value)
            setPickingIcon(false)
          }}
          onClose={() => setPickingIcon(false)}
        />
      )}
    </main>
  )
}

function ColorOption({
  label,
  checked,
  onChange,
  background,
  foreground = '#1e293b',
}: {
  label: string
  checked: boolean
  onChange: () => void
  background: string
  foreground?: string
}) {
  return (
    <label className="cursor-pointer" title={label}>
      <input
        type="radio"
        name="color"
        checked={checked}
        onChange={onChange}
        aria-label={label}
        className="peer sr-only"
      />
      <span
        className="flex size-16 items-center justify-center rounded-full ring-offset-4 peer-checked:ring-4 peer-checked:ring-slate-800 peer-focus-visible:outline-4 peer-focus-visible:outline-offset-8 peer-focus-visible:outline-orange-400"
        style={{ background, color: foreground }}
      >
        {checked && <CheckIcon className="size-8 drop-shadow" aria-hidden="true" />}
      </span>
    </label>
  )
}
