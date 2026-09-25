import { useTranslation } from 'react-i18next'
import ExtraIcon from '~icons/fluent-emoji-flat/flexed-biceps'
import SparklesIcon from '~icons/fluent-emoji-flat/sparkles'
import SharedIcon from '~icons/fluent-emoji-flat/handshake'
import ReviewIcon from '~icons/fluent-emoji-flat/magnifying-glass-tilted-left'
import StarIcon from '~icons/fluent-emoji-flat/star'
import WarningIcon from '~icons/fluent-emoji-flat/warning'
import DownIcon from '~icons/lucide/arrow-down'
import UpIcon from '~icons/lucide/arrow-up'
import PlusIcon from '~icons/lucide/plus'

import type { Member } from '../../api/members'
import {
  TASK_BLOCKS,
  type Task,
  type TaskBlock,
  blockOf,
  sortForMember,
  taskData,
  updateTask,
  useSetTaskOrder,
  useTasksMutation,
} from '../../api/tasks'
import { Avatar } from '../../components/Avatar'
import { TaskIcon } from '../../components/TaskIcon'
import { TIME_OF_DAY_ICONS } from '../../components/TimeOfDayIcon'
import { Alert, Button, Section, Switch } from '../../components/ui'
import { errorMessage } from '../../errors'
import { recurrenceSummary } from '../../recurrence'
import { FilterChip } from './formParts'

interface TasksSectionProps {
  tasks: Task[] | undefined
  members: Member[]
  error: unknown
  /** Id der Person, nach der gefiltert wird; null = alle. */
  filter: number | null
  onFilter: (memberId: number | null) => void
  onEdit: (task: Task) => void
  onAdd: () => void
}

/** Sortierung für alle: nach Block (Tagesabschnitte, „Jederzeit“, Extras), dann nach Titel. */
function sortTasks(tasks: Task[], language: string) {
  const order = (task: Task) => TASK_BLOCKS.indexOf(blockOf(task))
  return [...tasks].sort((a, b) => order(a) - order(b) || a.title.localeCompare(b.title, language))
}

function blockLabel(t: (key: string) => string, block: TaskBlock) {
  return t(block === 'extra' ? 'family.extras' : block ? `times_of_day.${block}` : 'tasks.anytime')
}

function BlockIcon({ block }: { block: TaskBlock }) {
  const Icon = block === 'extra' ? ExtraIcon : block ? TIME_OF_DAY_ICONS[block] : SparklesIcon
  return <Icon className="size-8 shrink-0" aria-hidden="true" />
}

/** Aufgabenübersicht im Elternbereich, filterbar nach Person. */
export function TasksSection({
  tasks,
  members,
  error,
  filter,
  onFilter,
  onEdit,
  onAdd,
}: TasksSectionProps) {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language
  const toggleActive = useTasksMutation((task: Task) =>
    updateTask(task.id, { ...taskData(task), active: !task.active }),
  )

  const setOrder = useSetTaskOrder()

  const membersById = new Map(members.map((member) => [member.id, member]))
  const filterMember = filter === null ? undefined : membersById.get(filter)
  // Für eine Person: ihre Reihenfolge am Display, zum Umsortieren; sonst alphabetisch.
  const visible = filterMember
    ? sortForMember(
        (tasks ?? []).filter((task) => task.member_ids.includes(filterMember.id)),
        filterMember.id,
      )
    : sortTasks(tasks ?? [], language)

  /** Verschiebt eine Aufgabe innerhalb ihres Blocks um einen Platz. */
  const move = (task: Task, direction: -1 | 1) => {
    if (!filterMember) return
    const ids = visible.map((candidate) => candidate.id)
    const from = ids.indexOf(task.id)
    ;[ids[from], ids[from + direction]] = [ids[from + direction], ids[from]]
    setOrder.mutate({ memberId: filterMember.id, taskIds: ids })
  }
  const row = (task: Task, index: number, list: Task[]) => (
    <TaskRow
      key={task.id}
      task={task}
      members={task.member_ids.flatMap((id) => membersById.get(id) ?? [])}
      language={language}
      busy={toggleActive.isPending && toggleActive.variables?.id === task.id}
      onEdit={() => onEdit(task)}
      onToggleActive={() => toggleActive.mutate(task)}
      move={
        filterMember && list.length > 1
          ? {
              up: index > 0 ? () => move(task, -1) : undefined,
              down: index < list.length - 1 ? () => move(task, 1) : undefined,
            }
          : undefined
      }
    />
  )

  return (
    <Section title={t('tasks.section')}>
      {error ? <Alert>{errorMessage(t, error)}</Alert> : null}
      {toggleActive.isError && <Alert>{errorMessage(t, toggleActive.error)}</Alert>}
      {setOrder.isError && <Alert>{errorMessage(t, setOrder.error)}</Alert>}

      {members.length === 0 ? (
        <p className="text-lg text-slate-600">{t('tasks.need_members')}</p>
      ) : (
        <>
          {tasks && tasks.length > 0 && (
            <div
              role="group"
              aria-label={t('tasks.filter')}
              className="-mx-1 flex gap-2 overflow-x-auto px-1 py-1"
            >
              <FilterChip pressed={!filterMember} onClick={() => onFilter(null)}>
                {t('tasks.filter_all')}
              </FilterChip>
              {members.map((member) => (
                <FilterChip
                  key={member.id}
                  pressed={filterMember?.id === member.id}
                  onClick={() => onFilter(member.id)}
                >
                  <Avatar
                    name={member.name}
                    color={member.color}
                    src={member.avatar_url}
                    size="sm"
                  />
                  {member.name}
                </FilterChip>
              ))}
            </div>
          )}

          {tasks?.length === 0 && <p className="text-lg text-slate-600">{t('tasks.empty')}</p>}
          {tasks && tasks.length > 0 && visible.length === 0 && filterMember && (
            <p className="text-lg text-slate-600">
              {t('tasks.filter_empty', { name: filterMember.name })}
            </p>
          )}

          {visible.length > 0 && !filterMember && (
            <ul className="flex flex-col gap-3">
              {visible.map((task, index, list) => row(task, index, list))}
            </ul>
          )}
          {visible.length > 0 && filterMember && (
            <>
              <p className="text-lg text-slate-600">
                {t('tasks.order_hint', { name: filterMember.name })}
              </p>
              {TASK_BLOCKS.map((block) => {
                const list = visible.filter((task) => blockOf(task) === block)
                if (list.length === 0) return null
                const label = blockLabel(t, block)
                return (
                  <section
                    key={block ?? 'anytime'}
                    aria-label={label}
                    className="flex flex-col gap-2"
                  >
                    <h3 className="flex items-center gap-2 text-lg font-extrabold text-slate-700">
                      <BlockIcon block={block} />
                      {label}
                    </h3>
                    <ol className="flex flex-col gap-3">
                      {list.map((task, index) => row(task, index, list))}
                    </ol>
                  </section>
                )
              })}
            </>
          )}

          <Button className="self-start" onClick={onAdd} disabled={tasks === undefined}>
            <PlusIcon className="size-6" aria-hidden="true" />
            {t('tasks.add')}
          </Button>
        </>
      )}
    </Section>
  )
}

function TaskRow({
  task,
  members,
  language,
  busy,
  onEdit,
  onToggleActive,
  move,
}: {
  task: Task
  members: Member[]
  language: string
  busy: boolean
  onEdit: () => void
  onToggleActive: () => void
  /** Nur in der Reihenfolge einer Person: einen Platz nach oben bzw. unten. */
  move?: { up?: () => void; down?: () => void }
}) {
  const { t } = useTranslation()
  const TimeIcon = task.time_of_day ? TIME_OF_DAY_ICONS[task.time_of_day] : null

  return (
    <li
      className={`flex items-center gap-3 rounded-2xl border-2 border-slate-100 p-2 sm:p-3 ${task.active ? '' : 'bg-slate-50'}`}
    >
      <button
        type="button"
        onClick={onEdit}
        aria-label={t('tasks.edit_title', { title: task.title })}
        className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2 rounded-xl p-1 text-left transition-colors hover:bg-orange-50 focus-visible:outline-4 focus-visible:outline-orange-400 active:bg-orange-100"
      >
        <TaskIcon icon={task.icon} className={`size-14 ${task.active ? '' : 'opacity-40'}`} />
        <span className="flex min-w-0 flex-1 basis-48 flex-col gap-1">
          <span className="text-lg font-bold break-words text-slate-800">
            {task.title}
            {!task.active && (
              <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-sm font-bold text-slate-600">
                {t('tasks.inactive')}
              </span>
            )}
          </span>
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-base text-slate-600">
            <span>{recurrenceSummary(t, language, task.recurrence)}</span>
            {TimeIcon && task.time_of_day && (
              <span className="inline-flex items-center gap-1">
                <TimeIcon className="size-6" aria-hidden="true" />
                {t(`times_of_day.${task.time_of_day}`)}
              </span>
            )}
            {task.extra && (
              <span className="inline-flex items-center gap-1">
                <ExtraIcon className="size-6" aria-hidden="true" />
                {t('tasks.extra')}
              </span>
            )}
            {task.shared && task.member_ids.length > 1 && (
              <span className="inline-flex items-center gap-1">
                <SharedIcon className="size-6" aria-hidden="true" />
                {t('tasks.shared')}
              </span>
            )}
            {task.needs_approval && (
              <span className="inline-flex items-center gap-1">
                <ReviewIcon className="size-6" aria-hidden="true" />
                {t('tasks.needs_approval')}
              </span>
            )}
            <span className="inline-flex items-center gap-1 font-bold text-slate-700">
              <StarIcon className="size-6" aria-hidden="true" />
              <span aria-hidden="true">{task.points}</span>
              <span className="sr-only">{t('tasks.points_count', { count: task.points })}</span>
            </span>
          </span>
        </span>
        {members.length > 0 ? (
          <span className="flex flex-wrap -space-x-2">
            {members.map((member) => (
              <Avatar
                key={member.id}
                name={member.name}
                color={member.color}
                src={member.avatar_url}
                size="sm"
                label={member.name}
              />
            ))}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-base font-bold text-amber-900">
            <WarningIcon className="size-6" aria-hidden="true" />
            {t('tasks.unassigned')}
          </span>
        )}
      </button>
      {move && (
        <span className="flex shrink-0 flex-col gap-1">
          <button
            type="button"
            onClick={move.up}
            disabled={!move.up}
            aria-label={t('tasks.move_up', { title: task.title })}
            className="flex size-12 items-center justify-center rounded-xl bg-slate-100 text-slate-700 hover:bg-orange-100 focus-visible:outline-4 focus-visible:outline-orange-400 disabled:opacity-30"
          >
            <UpIcon className="size-6" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={move.down}
            disabled={!move.down}
            aria-label={t('tasks.move_down', { title: task.title })}
            className="flex size-12 items-center justify-center rounded-xl bg-slate-100 text-slate-700 hover:bg-orange-100 focus-visible:outline-4 focus-visible:outline-orange-400 disabled:opacity-30"
          >
            <DownIcon className="size-6" aria-hidden="true" />
          </button>
        </span>
      )}
      <Switch
        checked={task.active}
        onChange={onToggleActive}
        disabled={busy}
        label={t('tasks.active_toggle', { title: task.title })}
      />
    </li>
  )
}
