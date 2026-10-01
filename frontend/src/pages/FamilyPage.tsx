import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import HouseIcon from '~icons/fluent-emoji-flat/house-with-garden'

import { useMe } from '../api/auth'
import { type ChorePlan, useChores } from '../api/chores'
import type { Member } from '../api/members'
import { type Today, pointsFor } from '../api/today'
import { Avatar } from '../components/Avatar'
import { Alert, Button } from '../components/ui'
import { errorMessage } from '../errors'
import { formatLongDate } from '../weekdays'
import { WhoBar } from './chores/WhoBar'
import { useChoreDone } from './chores/useChoreDone'
import { DayProgress } from './family/DayProgress'
import { HouseholdAvatar, HouseholdColumn } from './family/HouseholdColumn'
import { TaskGroups } from './family/TaskGroups'
import { ViewToggle } from './family/ViewToggle'
import { currentTasks, tasksFor, useFamilyToday } from './family/useFamilyToday'

/**
 * Aufgaben heute: eine Spalte je Kind mit seinen Aufgaben, daneben der Haushalt mit dem, was in
 * „Zu erledigen“ steht und im Putzplan dran ist. Erwachsene haben keine eigenen Aufgaben mehr.
 */
export function FamilyPage() {
  const { t, i18n } = useTranslation()
  const { data: me } = useMe()
  const { members, today, isPending, error, refetch } = useFamilyToday()
  // Der Putzplan kommt dazu, sobald er geladen ist; ohne ihn stehen nur die Kinder da.
  const chores = useChores().data
  const children = members?.filter((member) => member.role === 'child') ?? []
  const household =
    chores && (chores.chores.some((chore) => chore.active) || chores.todos.length > 0)
      ? chores
      : undefined

  const language = i18n.resolvedLanguage ?? i18n.language

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="text-3xl font-extrabold text-orange-600">{me?.family.name}</h1>
        {today && (
          <p className="text-xl font-bold text-slate-600">{formatLongDate(language, today.date)}</p>
        )}
        <div className="ml-auto">
          <ViewToggle current="day" />
        </div>
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
      ) : children.length === 0 && !household ? (
        <NoColumns anyMembers={members.length > 0} />
      ) : (
        <Columns members={members} kids={children} today={today} household={household} />
      )}
    </main>
  )
}

type Selection = number | 'household'

function Columns({
  members,
  kids,
  today,
  household,
}: {
  /** Alle Personen, für „Wer war's?“ und die faire Verteilung im Haushalt. */
  members: Member[]
  kids: Member[]
  today: Today
  household: ChorePlan | undefined
}) {
  const { t } = useTranslation()
  const [selectedId, setSelectedId] = useState<Selection | null>(null)
  const done = useChoreDone(household?.chores ?? [], household?.todos)
  // Am Smartphone ist genau eine Spalte sichtbar; Standard ist das erste Kind.
  const available: Selection[] = [
    ...kids.map((child) => child.id),
    ...(household ? (['household'] as const) : []),
  ]
  const selected = available.find((id) => id === selectedId) ?? available[0]
  const shown = (id: Selection) => (id === selected ? 'flex' : 'hidden sm:flex')
  const chooser = (id: Selection) =>
    `shrink-0 rounded-full focus-visible:outline-4 focus-visible:outline-orange-400 ${id === selected ? '' : 'opacity-50'}`

  return (
    <>
      <div
        role="group"
        aria-label={t('family.choose_person')}
        className="-mx-1 flex gap-3 overflow-x-auto px-1 py-1 sm:hidden"
      >
        {kids.map((child) => (
          <button
            key={child.id}
            type="button"
            aria-pressed={child.id === selected}
            onClick={() => setSelectedId(child.id)}
            className={chooser(child.id)}
          >
            <Avatar
              name={child.name}
              color={child.color}
              src={child.avatar_url}
              label={child.name}
            />
          </button>
        ))}
        {household && (
          <button
            type="button"
            aria-pressed={selected === 'household'}
            onClick={() => setSelectedId('household')}
            className={chooser('household')}
          >
            <HouseholdAvatar label={t('chores.title')} />
          </button>
        )}
      </div>
      {/* Viele Spalten: waagerecht wischbar. */}
      <div className="-mx-4 flex flex-1 snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
        {kids.map((child) => (
          <MemberColumn key={child.id} member={child} today={today} className={shown(child.id)} />
        ))}
        {household && (
          <HouseholdColumn
            plan={household}
            members={members}
            done={done}
            className={shown('household')}
          />
        )}
      </div>
      <WhoBar done={done} />
    </>
  )
}

function MemberColumn({
  member,
  today,
  className,
}: {
  member: Member
  today: Today
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
        className="flex flex-col items-center gap-1 rounded-3xl p-1 focus-visible:outline-4 focus-visible:outline-orange-400"
      >
        <Avatar name={member.name} color={member.color} src={member.avatar_url} size="md" />
        <span className="w-full truncate text-center text-xl font-extrabold text-slate-800">
          {member.name}
        </span>
      </Link>
      <DayProgress
        member={member}
        tasks={currentTasks(tasks, member.id, today.date)}
        points={pointsFor(today, member.id)}
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

/** Weder Kinder noch Putzplan: Hinweis mit Weg in den Elternbereich. */
function NoColumns({ anyMembers }: { anyMembers: boolean }) {
  const { t } = useTranslation()
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <HouseIcon className="size-32" aria-hidden="true" />
      <h2 className="text-3xl font-extrabold text-slate-800">
        {t(anyMembers ? 'family.no_children' : 'family.no_members')}
      </h2>
      <p className="max-w-xl text-xl text-slate-600">
        {t(anyMembers ? 'family.no_children_hint' : 'family.no_members_hint')}
      </p>
      <Link
        to="/parents/family"
        className="inline-flex min-h-14 items-center rounded-2xl bg-orange-500 px-6 py-3 text-lg font-bold text-white hover:bg-orange-600 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
      >
        {t('family.open_parents')}
      </Link>
    </section>
  )
}
