import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import CalendarIcon from '~icons/fluent-emoji-flat/spiral-calendar'
import StarIcon from '~icons/fluent-emoji-flat/glowing-star'

/** Umschalter im Aufgabenbereich: heutige Aufgaben oder die ganze Woche. */
export function ViewToggle({ current }: { current: 'day' | 'week' }) {
  const { t } = useTranslation()
  const option = (value: 'day' | 'week', to: string, label: string, Icon: typeof StarIcon) => (
    <Link
      to={to}
      aria-current={current === value ? 'page' : undefined}
      className={`flex min-h-14 items-center gap-2 rounded-2xl px-4 text-lg font-bold focus-visible:outline-4 focus-visible:outline-orange-400 ${current === value ? 'bg-orange-500 text-white' : 'text-slate-700 hover:bg-orange-50'}`}
    >
      <Icon className="size-8" aria-hidden="true" />
      {label}
    </Link>
  )
  return (
    <nav
      aria-label={t('task_week.views')}
      className="flex gap-1 rounded-3xl bg-white p-1 shadow-sm"
    >
      {option('day', '/tasks', t('task_week.day'), StarIcon)}
      {option('week', '/tasks/week', t('task_week.week'), CalendarIcon)}
    </nav>
  )
}
