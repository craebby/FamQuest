import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import StarIcon from '~icons/fluent-emoji-flat/star'
import WarningIcon from '~icons/fluent-emoji-flat/warning'
import PlusIcon from '~icons/lucide/plus'

import type { Member } from '../../api/members'
import { TIMES_OF_DAY, type Task, taskData, updateTask, useTasksMutation } from '../../api/tasks'
import { Avatar } from '../../components/Avatar'
import { TaskIcon } from '../../components/TaskIcon'
import { TIME_OF_DAY_ICONS } from '../../components/TimeOfDayIcon'
import { Alert, Button, Section, Switch } from '../../components/ui'
import { errorMessage } from '../../errors'
import { recurrenceSummary } from '../../recurrence'

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

/** Sortierung: nach Tagesabschnitt (ohne Abschnitt zuletzt), dann nach Titel. */
function sortTasks(tasks: Task[], language: string) {
  const order = (task: Task) =>
    task.time_of_day ? TIMES_OF_DAY.indexOf(task.time_of_day) : TIMES_OF_DAY.length
  return [...tasks].sort((a, b) => order(a) - order(b) || a.title.localeCompare(b.title, language))
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

  const membersById = new Map(members.map((member) => [member.id, member]))
  const filterMember = filter === null ? undefined : membersById.get(filter)
  const visible = sortTasks(
    (tasks ?? []).filter((task) => !filterMember || task.member_ids.includes(filterMember.id)),
    language,
  )

  return (
    <Section title={t('tasks.section')}>
      {error ? <Alert>{errorMessage(t, error)}</Alert> : null}
      {toggleActive.isError && <Alert>{errorMessage(t, toggleActive.error)}</Alert>}

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

          {visible.length > 0 && (
            <ul className="flex flex-col gap-3">
              {visible.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  members={task.member_ids.flatMap((id) => membersById.get(id) ?? [])}
                  language={language}
                  busy={toggleActive.isPending && toggleActive.variables?.id === task.id}
                  onEdit={() => onEdit(task)}
                  onToggleActive={() => toggleActive.mutate(task)}
                />
              ))}
            </ul>
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

function FilterChip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className="flex min-h-14 shrink-0 items-center gap-2 rounded-full py-1 pr-5 pl-1 text-lg font-bold whitespace-nowrap text-slate-700 ring-2 ring-slate-200 first:pl-5 focus-visible:outline-4 focus-visible:outline-orange-400 aria-pressed:bg-orange-500 aria-pressed:text-white aria-pressed:ring-orange-500"
    >
      {children}
    </button>
  )
}

function TaskRow({
  task,
  members,
  language,
  busy,
  onEdit,
  onToggleActive,
}: {
  task: Task
  members: Member[]
  language: string
  busy: boolean
  onEdit: () => void
  onToggleActive: () => void
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
      <Switch
        checked={task.active}
        onChange={onToggleActive}
        disabled={busy}
        label={t('tasks.active_toggle', { title: task.title })}
      />
    </li>
  )
}
