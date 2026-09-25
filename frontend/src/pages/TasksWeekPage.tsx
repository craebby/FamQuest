import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import LeftIcon from '~icons/fluent-emoji-flat/left-arrow'
import RightIcon from '~icons/fluent-emoji-flat/right-arrow'
import HourglassIcon from '~icons/fluent-emoji-flat/hourglass-not-done'
import BeachIcon from '~icons/fluent-emoji-flat/beach-with-umbrella'
import CheckIcon from '~icons/lucide/check'

import { type Member, useMembers } from '../api/members'
import { sortForMember } from '../api/tasks'
import { type TaskWeek, type WeekEntry, type WeekTask, useTaskWeek } from '../api/taskWeek'
import { Avatar } from '../components/Avatar'
import { TaskIcon } from '../components/TaskIcon'
import { Alert, Button } from '../components/ui'
import { errorMessage } from '../errors'
import { colorTokens } from '../memberColors'
import { ViewToggle } from './family/ViewToggle'

function parseDate(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

/**
 * Aufgaben der Woche (Montag bis Sonntag): je Tag und Person die Aufgaben als Symbole, erledigte
 * in der Personenfarbe mit Haken, verpasste blass. Nur zum Anschauen; erledigt wird heute.
 */
export function TasksWeekPage() {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language
  const [offset, setOffset] = useState(0)
  const week = useTaskWeek(offset)
  const members = useMembers()
  const data = week.data

  const title = data
    ? new Intl.DateTimeFormat(language, {
        day: 'numeric',
        month: 'long',
        timeZone: 'UTC',
      }).formatRange(parseDate(data.days[0].date), parseDate(data.days[6].date))
    : t('task_week.week')

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-extrabold text-orange-600">{title}</h1>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            aria-label={t('calendar.previous_week')}
            title={t('calendar.previous_week')}
            onClick={() => setOffset(offset - 1)}
            className="px-4"
          >
            <LeftIcon className="size-8" aria-hidden="true" />
          </Button>
          {offset !== 0 && (
            <Button variant="secondary" onClick={() => setOffset(0)}>
              {t('calendar.this_week')}
            </Button>
          )}
          <Button
            variant="secondary"
            aria-label={t('calendar.next_week')}
            title={t('calendar.next_week')}
            onClick={() => setOffset(offset + 1)}
            className="px-4"
          >
            <RightIcon className="size-8" aria-hidden="true" />
          </Button>
        </div>
        <div className="ml-auto">
          <ViewToggle current="week" />
        </div>
      </header>
      {week.isPending || members.isPending ? (
        <p role="status" className="text-xl text-slate-600">
          {t('common.loading')}
        </p>
      ) : !data || !members.data ? (
        <div className="flex flex-col items-start gap-4">
          <Alert>{errorMessage(t, week.error ?? members.error)}</Alert>
          <Button onClick={() => void week.refetch()}>{t('actions.retry')}</Button>
        </div>
      ) : (
        <Days week={data} members={members.data} />
      )}
    </main>
  )
}

function Days({ week, members }: { week: TaskWeek; members: Member[] }) {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language
  const weekday = new Intl.DateTimeFormat(language, { weekday: 'short', timeZone: 'UTC' })
  const longDate = new Intl.DateTimeFormat(language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
  const tasks = new Map(week.tasks.map((task) => [task.id, task]))

  return (
    // Großer Bildschirm: sieben Spalten nebeneinander; schmal: Tage untereinander.
    <div className="grid flex-1 grid-cols-1 gap-3 lg:grid-cols-7">
      {week.days.map((day) => {
        const date = parseDate(day.date)
        const isToday = day.date === week.today
        const rows = members
          .map((member) => ({
            member,
            entries: day.entries.filter((entry) => entry.member_id === member.id),
          }))
          .filter((row) => row.entries.length > 0)
        return (
          <section
            key={day.date}
            aria-label={longDate.format(date)}
            aria-current={isToday ? 'date' : undefined}
            className={`flex min-w-0 flex-col gap-2 rounded-3xl p-2 ${isToday ? 'bg-orange-100 ring-4 ring-orange-400' : 'bg-white/60'}`}
          >
            <h2
              className={`flex items-baseline gap-2 rounded-2xl px-3 py-1 ${isToday ? 'bg-orange-500 text-white' : 'text-slate-700'}`}
            >
              <span className="text-lg font-bold">{weekday.format(date)}</span>
              <span className="text-3xl font-extrabold">{date.getUTCDate()}</span>
              {isToday && (
                <span className="ml-auto text-base font-bold">{t('calendar.today')}</span>
              )}
            </h2>
            {rows.length === 0 ? (
              <p className="flex items-center gap-2 px-3 py-2 text-base text-slate-400">
                <BeachIcon className="size-6" aria-hidden="true" />
                {t('task_week.free')}
              </p>
            ) : (
              rows.map(({ member, entries }) => (
                <MemberDay
                  key={member.id}
                  member={member}
                  members={members}
                  entries={entries}
                  tasks={tasks}
                  past={day.date < week.today}
                />
              ))
            )}
          </section>
        )
      })}
    </div>
  )
}

function MemberDay({
  member,
  members,
  entries,
  tasks,
  past,
}: {
  member: Member
  members: Member[]
  entries: WeekEntry[]
  tasks: Map<number, WeekTask>
  past: boolean
}) {
  const { t } = useTranslation()
  const tokens = colorTokens(member.color)
  const byTask = new Map(entries.map((entry) => [entry.task_id, entry]))
  const ordered = sortForMember(
    entries.flatMap((entry) => tasks.get(entry.task_id) ?? []),
    member.id,
  )
  // Wie auf der Startseite: Extras und von anderen erledigte Aufgaben zählen nicht mit.
  const counted = ordered.filter((task) => {
    const entry = byTask.get(task.id)!
    return !task.extra && (entry.done_by === null || entry.done_by === member.id)
  })
  const done = counted.filter((task) => byTask.get(task.id)!.done_by === member.id).length

  return (
    <div
      className="flex flex-col gap-1 rounded-2xl border-l-4 bg-white/80 p-2"
      style={{ borderLeftColor: tokens.main }}
    >
      <p className="flex items-center gap-2">
        <Avatar name={member.name} color={member.color} src={member.avatar_url} size="xs" />
        <span className="min-w-0 flex-1 truncate text-base font-bold text-slate-700">
          {member.name}
        </span>
        {counted.length > 0 && (
          <span className="text-base font-extrabold text-slate-600 tabular-nums">
            <span className="sr-only">{t('points.progress', { done, total: counted.length })}</span>
            <span aria-hidden="true">
              {done}/{counted.length}
            </span>
          </span>
        )}
      </p>
      <ul className="flex flex-wrap gap-1">
        {ordered.map((task) => (
          <WeekTaskIcon
            key={task.id}
            task={task}
            entry={byTask.get(task.id)!}
            member={member}
            doneBy={members.find((candidate) => candidate.id === byTask.get(task.id)!.done_by)}
            past={past}
          />
        ))}
      </ul>
    </div>
  )
}

function WeekTaskIcon({
  task,
  entry,
  member,
  doneBy,
  past,
}: {
  task: WeekTask
  entry: WeekEntry
  member: Member
  doneBy: Member | undefined
  past: boolean
}) {
  const { t } = useTranslation()
  const tokens = colorTokens(task.color ?? member.color)
  const byOther = doneBy !== undefined && doneBy.id !== member.id
  const state =
    entry.status === 'open'
      ? past
        ? t('task_week.missed')
        : t('task_week.open')
      : entry.status === 'pending'
        ? t('family.pending')
        : byOther
          ? t('family.done_by', { name: doneBy.name })
          : t('task_week.done')

  return (
    <li
      title={task.title}
      aria-label={`${task.title}: ${state}`}
      className={`relative flex size-11 items-center justify-center rounded-xl border-2 ${task.extra ? 'border-dashed' : ''} ${entry.status === 'open' && past ? 'opacity-30 grayscale' : ''} ${byOther ? 'opacity-50 grayscale' : ''}`}
      style={{
        backgroundColor: entry.status === 'done' && !byOther ? tokens.soft : '#ffffff',
        borderColor: entry.status === 'done' && !byOther ? tokens.main : '#e2e8f0',
      }}
    >
      <TaskIcon icon={task.icon} className="size-8" />
      {entry.status === 'pending' ? (
        <span
          aria-hidden="true"
          className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-white shadow-sm"
        >
          <HourglassIcon className="size-4" />
        </span>
      ) : (
        entry.status === 'done' && (
          <span
            aria-hidden="true"
            className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full"
            style={
              byOther
                ? { backgroundColor: '#94a3b8', color: '#ffffff' }
                : { backgroundColor: tokens.main, color: tokens.onMain }
            }
          >
            <CheckIcon className="size-3.5" strokeWidth={4} />
          </span>
        )
      )}
    </li>
  )
}
