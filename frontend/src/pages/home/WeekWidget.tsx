import { useTranslation } from 'react-i18next'
import CalendarIcon from '~icons/fluent-emoji-flat/calendar'
import CheckIcon from '~icons/lucide/check'

import { type Member, useMembers } from '../../api/members'
import { type TaskWeek, dayProgress, useTaskWeek } from '../../api/taskWeek'
import { Avatar } from '../../components/Avatar'
import { errorMessage } from '../../errors'
import { colorTokens } from '../../memberColors'
import { Widget } from './Widget'

function parseDate(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

/** Die Woche auf einen Blick: je Person ein Ring pro Tag, voll = alles geschafft. */
export function WeekWidget({ className }: { className?: string }) {
  const { t } = useTranslation()
  const week = useTaskWeek(0)
  const members = useMembers()

  return (
    <Widget
      title={t('home.week')}
      icon={CalendarIcon}
      more={{ to: '/tasks/week', label: t('home.open_week') }}
      className={className}
    >
      {week.isPending || members.isPending ? (
        <p role="status" className="text-lg text-slate-500">
          {t('common.loading')}
        </p>
      ) : !week.data || !members.data ? (
        <p className="text-lg text-slate-600">{errorMessage(t, week.error ?? members.error)}</p>
      ) : (
        <WeekGrid week={week.data} members={members.data} />
      )}
    </Widget>
  )
}

function WeekGrid({ week, members }: { week: TaskWeek; members: Member[] }) {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language
  const short = new Intl.DateTimeFormat(language, { weekday: 'narrow', timeZone: 'UTC' })
  const long = new Intl.DateTimeFormat(language, { weekday: 'long', timeZone: 'UTC' })
  const tasks = new Map(week.tasks.map((task) => [task.id, task]))
  const rows = members.filter((member) =>
    week.days.some((day) => dayProgress(day.entries, tasks, member.id).total > 0),
  )

  if (rows.length === 0) return <p className="text-lg text-slate-500">{t('home.week_empty')}</p>

  return (
    <table className="w-full table-fixed border-separate border-spacing-y-1">
      <thead>
        <tr>
          <th className="w-10">
            <span className="sr-only">{t('home.person')}</span>
          </th>
          {week.days.map((day) => (
            <th
              key={day.date}
              scope="col"
              aria-current={day.date === week.today ? 'date' : undefined}
              className={`text-base font-bold ${day.date === week.today ? 'text-orange-600' : 'text-slate-500'}`}
            >
              <abbr title={long.format(parseDate(day.date))} className="no-underline">
                {short.format(parseDate(day.date))}
              </abbr>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((member) => (
          <tr key={member.id}>
            <th scope="row" className="text-left">
              <Avatar
                name={member.name}
                color={member.color}
                src={member.avatar_url}
                size="xs"
                label={member.name}
              />
            </th>
            {week.days.map((day) => (
              <td
                key={day.date}
                className={`rounded-xl py-1 text-center ${day.date === week.today ? 'bg-orange-100' : ''}`}
              >
                <DayRing
                  member={member}
                  label={long.format(parseDate(day.date))}
                  future={day.date > week.today}
                  {...dayProgress(day.entries, tasks, member.id)}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function DayRing({
  member,
  label,
  future,
  done,
  total,
}: {
  member: Member
  label: string
  future: boolean
  done: number
  total: number
}) {
  const { t } = useTranslation()
  const tokens = colorTokens(member.color)
  const text = total === 0 ? t('home.week_free') : t('points.progress', { done, total })
  const title = `${label}: ${text}`

  if (total === 0) {
    return (
      <span
        role="img"
        aria-label={title}
        title={title}
        className="inline-flex size-9 items-center justify-center"
      >
        <span className="size-2 rounded-full bg-slate-200" />
      </span>
    )
  }
  if (done === total) {
    return (
      <span
        role="img"
        aria-label={title}
        title={title}
        className="inline-flex size-9 items-center justify-center rounded-full"
        style={{ backgroundColor: tokens.main, color: tokens.onMain }}
      >
        <CheckIcon className="size-5" strokeWidth={4} aria-hidden="true" />
      </span>
    )
  }
  const share = (done / total) * 100
  return (
    <span
      role="img"
      aria-label={title}
      title={title}
      className={`inline-flex size-9 items-center justify-center rounded-full ${future ? 'opacity-40' : ''}`}
      style={{ background: `conic-gradient(${tokens.main} ${share}%, #e2e8f0 0)` }}
    >
      <span className="size-6 rounded-full bg-white" />
    </span>
  )
}
