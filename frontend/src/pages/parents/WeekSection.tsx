import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import ChevronLeftIcon from '~icons/lucide/chevron-left'
import ChevronRightIcon from '~icons/lucide/chevron-right'
import CheckIcon from '~icons/lucide/check'

import type { Member } from '../../api/members'
import { type WeekDay, useWeek } from '../../api/week'
import { Avatar } from '../../components/Avatar'
import { Alert, Button, Section } from '../../components/ui'
import { errorMessage } from '../../errors'
import { colorTokens } from '../../memberColors'
import { addDays, formatLongDate, formatShortDate, isoWeekday, weekdayName } from '../../weekdays'

/** Wochenübersicht: je Person und Tag ein Ring, wie viel der anstehenden Aufgaben erledigt ist. */
export function WeekSection({ members }: { members: Member[] }) {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language
  const [start, setStart] = useState<string | null>(null)
  const week = useWeek(start)

  if (members.length === 0) return null
  const data = week.data
  const days = data?.members[0]?.days.map((day) => day.date) ?? []
  const current = data && data.today >= data.start && data.today <= addDays(data.start, 6)

  return (
    <Section title={t('week.section')}>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          aria-label={t('week.previous')}
          disabled={!data}
          onClick={() => data && setStart(addDays(data.start, -7))}
        >
          <ChevronLeftIcon className="size-7" aria-hidden="true" />
        </Button>
        <p className="min-w-40 text-center text-lg font-bold text-slate-700" aria-live="polite">
          {data &&
            t('week.range', {
              from: formatShortDate(language, data.start),
              to: formatShortDate(language, addDays(data.start, 6)),
            })}
        </p>
        <Button
          variant="secondary"
          aria-label={t('week.next')}
          disabled={!data}
          onClick={() => data && setStart(addDays(data.start, 7))}
        >
          <ChevronRightIcon className="size-7" aria-hidden="true" />
        </Button>
        {data && !current && (
          <Button variant="secondary" onClick={() => setStart(null)}>
            {t('week.this_week')}
          </Button>
        )}
      </div>

      {week.isError && <Alert>{errorMessage(t, week.error)}</Alert>}
      {data && (
        <div className="-mx-2 overflow-x-auto px-2">
          <table className="w-full min-w-[36rem] border-separate border-spacing-y-2">
            <thead>
              <tr>
                <th className="sr-only">{t('week.person')}</th>
                {days.map((date) => (
                  <th
                    key={date}
                    scope="col"
                    className={`px-1 text-center text-sm font-bold ${date === data.today ? 'text-orange-700' : 'text-slate-500'}`}
                  >
                    <span className="block text-base">
                      {weekdayName(language, isoWeekday(date), 'short')}
                    </span>
                    {formatShortDate(language, date)}
                  </th>
                ))}
                <th scope="col" className="px-1 text-center text-sm font-bold text-slate-500">
                  {t('week.total')}
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const entry = data.members.find((candidate) => candidate.member_id === member.id)
                if (!entry) return null
                const planned = entry.days.reduce((sum, day) => sum + day.planned, 0)
                const done = entry.days.reduce((sum, day) => sum + day.done, 0)
                return (
                  <tr key={member.id}>
                    <th scope="row" className="pr-2 text-left">
                      <span className="flex items-center gap-2">
                        <Avatar
                          name={member.name}
                          color={member.color}
                          src={member.avatar_url}
                          size="sm"
                        />
                        <span className="text-lg font-bold break-words text-slate-800">
                          {member.name}
                        </span>
                      </span>
                    </th>
                    {entry.days.map((day) => (
                      <td
                        key={day.date}
                        className={`rounded-2xl px-1 py-1 text-center ${day.date === data.today ? 'bg-orange-50' : ''}`}
                      >
                        <DayRing
                          day={day}
                          color={member.color}
                          future={day.date > data.today}
                          label={t('week.day_label', {
                            day: formatLongDate(language, day.date),
                            done: day.done,
                            count: day.planned,
                          })}
                        />
                      </td>
                    ))}
                    <td className="px-1 text-center text-lg font-extrabold text-slate-700 tabular-nums">
                      <span className="sr-only">
                        {t('week.total_label', { done, count: planned })}
                      </span>
                      <span aria-hidden="true">
                        {done}/{planned}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  )
}

/** Fortschrittsring eines Tages: voll und mit Haken, wenn alles erledigt ist. */
function DayRing({
  day,
  color,
  future,
  label,
}: {
  day: WeekDay
  color: string
  future: boolean
  label: string
}) {
  const tokens = colorTokens(color)
  const radius = 20
  const circumference = 2 * Math.PI * radius
  const share = day.planned > 0 ? Math.min(1, day.done / day.planned) : 0
  const complete = day.planned > 0 && day.done >= day.planned

  return (
    <span
      role="img"
      aria-label={label}
      className={`relative mx-auto flex size-12 items-center justify-center ${future ? 'opacity-50' : ''}`}
    >
      <svg viewBox="0 0 48 48" className="absolute inset-0 size-full -rotate-90" aria-hidden="true">
        <circle cx="24" cy="24" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="6" />
        {share > 0 && (
          <circle
            cx="24"
            cy="24"
            r={radius}
            fill={complete ? tokens.soft : 'none'}
            stroke={tokens.main}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${share * circumference} ${circumference}`}
          />
        )}
      </svg>
      <span
        aria-hidden="true"
        className="relative text-sm font-extrabold text-slate-700 tabular-nums"
      >
        {day.planned === 0 ? (
          <span className="text-slate-400">–</span>
        ) : complete ? (
          <CheckIcon className="size-6" strokeWidth={4} style={{ color: tokens.strong }} />
        ) : (
          `${day.done}/${day.planned}`
        )}
      </span>
    </span>
  )
}
