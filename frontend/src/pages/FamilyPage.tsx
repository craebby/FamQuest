import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import HouseIcon from '~icons/fluent-emoji-flat/house-with-garden'

import { useMe } from '../api/auth'
import type { Member } from '../api/members'
import { type Today, pointsFor } from '../api/today'
import { Avatar } from '../components/Avatar'
import { Alert, Button } from '../components/ui'
import { errorMessage } from '../errors'
import { formatLongDate } from '../weekdays'
import { type CareSegment, careShares } from '../care'
import { DayProgress } from './family/DayProgress'
import { TaskGroups } from './family/TaskGroups'
import { tasksFor, useFamilyToday } from './family/useFamilyToday'

/** Familienansicht: eine Spalte pro Person mit ihren heutigen Aufgaben. */
export function FamilyPage() {
  const { t, i18n } = useTranslation()
  const { data: me } = useMe()
  const { members, today, isPending, error, refetch } = useFamilyToday()

  const language = i18n.resolvedLanguage ?? i18n.language

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="text-3xl font-extrabold text-orange-600">{me?.family.name}</h1>
        {today && (
          <p className="text-xl font-bold text-slate-600">{formatLongDate(language, today.date)}</p>
        )}
      </header>
      {isPending ? (
        <p role="status" className="text-xl text-slate-600">
          {t('common.loading')}
        </p>
      ) : !members || !today ? (
        <div className="flex flex-col items-start gap-4">
          <Alert>{errorMessage(t, error)}</Alert>
          <Button onClick={() => void refetch()}>{t('actions.retry')}</Button>
        </div>
      ) : members.length === 0 ? (
        <NoMembers />
      ) : (
        <Columns members={members} today={today} />
      )}
    </main>
  )
}

function Columns({ members, today }: { members: Member[]; today: Today }) {
  const { t } = useTranslation()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  // Am Smartphone ist genau eine Person sichtbar; Standard ist die erste.
  const selected = members.find((member) => member.id === selectedId) ?? members[0]
  const care = careShares(members, today)

  return (
    <>
      <div
        role="group"
        aria-label={t('family.choose_person')}
        className="-mx-1 flex gap-3 overflow-x-auto px-1 py-1 sm:hidden"
      >
        {members.map((member) => (
          <button
            key={member.id}
            type="button"
            aria-pressed={member.id === selected?.id}
            onClick={() => setSelectedId(member.id)}
            className={`shrink-0 rounded-full focus-visible:outline-4 focus-visible:outline-orange-400 ${member.id === selected?.id ? '' : 'opacity-50'}`}
          >
            <Avatar
              name={member.name}
              color={member.color}
              src={member.avatar_url}
              label={member.name}
            />
          </button>
        ))}
      </div>
      {/* Viele Personen: Spalten sind waagerecht wischbar. */}
      <div className="-mx-4 flex flex-1 snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
        {members.map((member) => (
          <MemberColumn
            key={member.id}
            member={member}
            today={today}
            care={care}
            className={member.id === selected?.id ? 'flex' : 'hidden sm:flex'}
          />
        ))}
      </div>
    </>
  )
}

function MemberColumn({
  member,
  today,
  care,
  className,
}: {
  member: Member
  today: Today
  care: CareSegment[] | null
  className: string
}) {
  const { t } = useTranslation()
  const tasks = tasksFor(today.tasks, member.id)
  return (
    <section
      aria-label={t('family.tasks_of', { name: member.name })}
      className={`w-full shrink-0 snap-start flex-col gap-4 sm:w-80 lg:max-w-xl lg:min-w-80 lg:flex-1 lg:basis-0 ${className}`}
    >
      <Link
        to={`/member/${member.id}`}
        aria-label={t('family.open_person', { name: member.name })}
        className="flex flex-col items-center gap-2 rounded-3xl p-2 focus-visible:outline-4 focus-visible:outline-orange-400"
      >
        <Avatar name={member.name} color={member.color} src={member.avatar_url} size="lg" />
        <span className="text-2xl font-extrabold break-words text-slate-800">{member.name}</span>
      </Link>
      <DayProgress
        member={member}
        tasks={tasks}
        points={pointsFor(today, member.id)}
        care={care}
        size="md"
      />
      <TaskGroups
        member={member}
        tasks={tasks}
        date={today.date}
        currentTimeOfDay={today.time_of_day}
        size="md"
      />
    </section>
  )
}

function NoMembers() {
  const { t } = useTranslation()
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <HouseIcon className="size-32" aria-hidden="true" />
      <h2 className="text-3xl font-extrabold text-slate-800">{t('family.no_members')}</h2>
      <p className="max-w-xl text-xl text-slate-600">{t('family.no_members_hint')}</p>
      <Link
        to="/parents"
        className="inline-flex min-h-14 items-center rounded-2xl bg-orange-500 px-6 py-3 text-lg font-bold text-white hover:bg-orange-600 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
      >
        {t('family.open_parents')}
      </Link>
    </section>
  )
}
