import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import StarIcon from '~icons/fluent-emoji-flat/star'
import CloseIcon from '~icons/lucide/x'

import { TaskIcon } from '../../components/TaskIcon'
import { TIME_OF_DAY_ICONS } from '../../components/TimeOfDayIcon'
import { Button } from '../../components/ui'
import {
  TASK_POOL,
  TASK_TEMPLATE_GROUPS,
  type TaskTemplate,
  type TaskTemplateGroup,
  taskTemplateIcon,
  taskTemplateTitle,
} from '../../pools/tasks'
import { recurrenceSummary } from '../../recurrence'
import { FilterChip } from './formParts'

interface TaskTemplatePickerProps {
  /** Gruppe beim Öffnen, z. B. „Haushalt“, wenn nur Erwachsene gewählt sind. */
  initialGroup: TaskTemplateGroup
  onSelect: (template: TaskTemplate, title: string) => void
  onClose: () => void
}

/** Vorlage für eine neue Aufgabe wählen; sie füllt den Editor vor. */
export function TaskTemplatePicker({ initialGroup, onSelect, onClose }: TaskTemplatePickerProps) {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language
  const [group, setGroup] = useState(initialGroup)
  const dialog = useRef<HTMLDivElement>(null)

  useEffect(() => {
    dialog.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-template-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-2 sm:p-4"
    >
      <div
        ref={dialog}
        tabIndex={-1}
        className="flex h-full max-h-[48rem] w-full max-w-4xl flex-col gap-4 overflow-hidden rounded-3xl bg-white p-4 outline-none sm:p-6"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="task-template-title" className="text-2xl font-extrabold text-slate-800">
            {t('tasks.templates')}
          </h2>
          <Button variant="secondary" onClick={onClose} aria-label={t('icon_picker.close')}>
            <CloseIcon className="size-7" aria-hidden="true" />
          </Button>
        </div>
        <div role="group" aria-label={t('tasks.template_groups')} className="flex gap-2">
          {TASK_TEMPLATE_GROUPS.map((value) => (
            <FilterChip key={value} pressed={group === value} onClick={() => setGroup(value)}>
              {t(`tasks.template_group_${value}`)}
            </FilterChip>
          ))}
        </div>
        <ul className="grid min-h-0 flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-3 overflow-y-auto p-1">
          {TASK_POOL.filter((template) => template.group === group).map((template) => {
            const title = taskTemplateTitle(t, template)
            const TimeIcon = template.time_of_day ? TIME_OF_DAY_ICONS[template.time_of_day] : null
            return (
              <li key={template.id}>
                <button
                  type="button"
                  onClick={() => onSelect(template, title)}
                  className="flex h-full w-full items-center gap-3 rounded-2xl border-2 border-slate-200 p-3 text-left transition-colors hover:bg-orange-50 focus-visible:outline-4 focus-visible:outline-orange-400 active:bg-orange-100"
                >
                  <TaskIcon icon={taskTemplateIcon(template)} className="size-14" />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-lg leading-tight font-bold break-words text-slate-800">
                      {title}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-3 text-base text-slate-600">
                      {recurrenceSummary(t, language, template.recurrence)}
                      {TimeIcon && <TimeIcon className="size-6" aria-hidden="true" />}
                      <span className="inline-flex items-center gap-1 font-bold">
                        <StarIcon className="size-5" aria-hidden="true" />
                        <span aria-hidden="true">{template.points}</span>
                        <span className="sr-only">
                          {t('tasks.points_count', { count: template.points })}
                        </span>
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
