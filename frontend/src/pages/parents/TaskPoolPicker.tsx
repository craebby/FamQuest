import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import StarIcon from '~icons/fluent-emoji-flat/star'
import SharedIcon from '~icons/fluent-emoji-flat/handshake'
import CheckIcon from '~icons/lucide/check'

import type { Member } from '../../api/members'
import { type Task, type TaskData, createTask, useTasksMutation } from '../../api/tasks'
import { Avatar } from '../../components/Avatar'
import { TaskIcon } from '../../components/TaskIcon'
import { TIME_OF_DAY_ICONS } from '../../components/TimeOfDayIcon'
import { Alert, Button } from '../../components/ui'
import { errorMessage } from '../../errors'
import { normalize } from '../../icons/catalog'
import { TASK_POOL, taskTemplateIcon, taskTemplateTitle, templateTask } from '../../pools/tasks'
import { flexibleSummary, recurrenceSummary } from '../../recurrence'
import { todayIn } from '../../weekdays'
import { Field, FilterChip } from './formParts'

interface TaskPoolPickerProps {
  /** Erwachsene der Familie; standardmäßig bekommen alle die gewählten Aufgaben. */
  adults: Member[]
  /** Vorhandene Aufgaben; gleichnamige Vorlagen sind schon abgehakt. */
  existing: Task[]
  timeZone: string
  onDone: (count: number) => void
  onCancel: () => void
}

async function createTasks(list: TaskData[]) {
  const created: Task[] = []
  for (const data of list) created.push(await createTask(data))
  return created
}

/** Mehrere Haushaltsaufgaben aus den Vorlagen auf einmal für die Erwachsenen übernehmen. */
export function TaskPoolPicker({
  adults,
  existing,
  timeZone,
  onDone,
  onCancel,
}: TaskPoolPickerProps) {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language
  const [selected, setSelected] = useState<string[]>([])
  const [memberIds, setMemberIds] = useState(() => adults.map((adult) => adult.id))
  const add = useTasksMutation(createTasks)
  const existingTitles = new Set(existing.map((task) => normalize(task.title.trim())))
  const templates = TASK_POOL.filter((template) => template.group === 'household').map(
    (template) => {
      const title = taskTemplateTitle(t, template)
      return { template, title, present: existingTitles.has(normalize(title)) }
    },
  )

  const toggle = <T,>(list: T[], value: T) =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value]

  const submit = () => {
    const today = todayIn(timeZone)
    add.mutate(
      templates
        .filter(({ template }) => selected.includes(template.id))
        .map(({ template, title }) => templateTask(template, title, memberIds, today)),
      { onSuccess: (created) => onDone(created.length) },
    )
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-6 p-4 pb-32 sm:p-6 sm:pb-32">
      <h1 className="text-3xl font-extrabold text-orange-600">{t('tasks.pool_title')}</h1>
      <p className="text-lg text-slate-600">{t('tasks.pool_intro')}</p>
      {add.isError && <Alert>{errorMessage(t, add.error)}</Alert>}

      <section className="flex flex-col gap-3 rounded-3xl bg-white p-4 shadow-sm sm:p-6">
        <Field
          label={t('tasks.pool_for')}
          error={memberIds.length === 0 ? t('tasks.pool_need_member') : undefined}
        >
          <div className="-mx-1 flex flex-wrap gap-2 px-1 py-1">
            {adults.map((adult) => (
              <FilterChip
                key={adult.id}
                pressed={memberIds.includes(adult.id)}
                onClick={() => setMemberIds(toggle(memberIds, adult.id))}
              >
                <Avatar name={adult.name} color={adult.color} src={adult.avatar_url} size="sm" />
                {adult.name}
              </FilterChip>
            ))}
          </div>
        </Field>
      </section>

      <section className="flex flex-col gap-3 rounded-3xl bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-2xl font-extrabold text-slate-800">
          {t('tasks.template_group_household')}
        </h2>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-3">
          {templates.map(({ template, title, present }) => {
            const checked = present || selected.includes(template.id)
            const TimeIcon = template.time_of_day ? TIME_OF_DAY_ICONS[template.time_of_day] : null
            return (
              <li key={template.id}>
                <label className={present ? 'cursor-not-allowed' : 'cursor-pointer'}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={present || add.isPending}
                    onChange={() => setSelected(toggle(selected, template.id))}
                    className="peer sr-only"
                  />
                  <span className="relative flex h-full items-center gap-3 rounded-2xl border-2 border-slate-200 p-3 pr-10 peer-checked:border-orange-500 peer-checked:bg-orange-50 peer-focus-visible:outline-4 peer-focus-visible:outline-orange-400 peer-disabled:opacity-60">
                    {checked && (
                      <span className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-orange-500 text-white">
                        <CheckIcon className="size-5" strokeWidth={4} aria-hidden="true" />
                      </span>
                    )}
                    <TaskIcon icon={taskTemplateIcon(template)} className="size-14" />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-lg leading-tight font-bold break-words text-slate-800">
                        {title}
                      </span>
                      <span className="flex flex-wrap items-center gap-x-3 text-base text-slate-600">
                        {template.recurrence.kind === 'flexible'
                          ? flexibleSummary(t, template.recurrence.interval_days)
                          : recurrenceSummary(t, language, template.recurrence)}
                        {TimeIcon && <TimeIcon className="size-6" aria-hidden="true" />}
                        {template.shared && (
                          <SharedIcon
                            className="size-6"
                            role="img"
                            aria-label={t('tasks.shared')}
                          />
                        )}
                        <span className="inline-flex items-center gap-1 font-bold">
                          <StarIcon className="size-5" aria-hidden="true" />
                          <span aria-hidden="true">{template.points}</span>
                          <span className="sr-only">
                            {t('tasks.points_count', { count: template.points })}
                          </span>
                        </span>
                      </span>
                      {present && (
                        <span className="text-sm font-bold text-slate-500">
                          {t('rewards.pool_present')}
                        </span>
                      )}
                    </span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-10 flex flex-wrap justify-center gap-3 border-t border-orange-100 bg-white/95 p-4 backdrop-blur">
        <Button
          onClick={submit}
          disabled={selected.length === 0 || memberIds.length === 0 || add.isPending}
        >
          {t('tasks.pool_add', { count: selected.length })}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={add.isPending}>
          {t('actions.cancel')}
        </Button>
      </div>
    </main>
  )
}
