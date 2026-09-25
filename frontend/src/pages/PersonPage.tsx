import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import BackIcon from '~icons/fluent-emoji-flat/left-arrow'
import GiftIcon from '~icons/fluent-emoji-flat/wrapped-gift'

import { pointsFor } from '../api/today'
import { Avatar } from '../components/Avatar'
import { Alert, Button } from '../components/ui'
import { careShares } from '../care'
import { errorMessage } from '../errors'
import { useIdleTimeout } from '../useIdleTimeout'
import { DayProgress } from './family/DayProgress'
import { TaskGroups } from './family/TaskGroups'
import { currentTasks, tasksFor, useFamilyToday } from './family/useFamilyToday'
import { RewardGrid } from './rewards/RewardGrid'

/** Nach dieser Zeit ohne Eingabe kehrt das Display zur Familienansicht zurück. */
export const PERSON_IDLE_TIMEOUT_MS = 60 * 1000

/** Personenansicht: dieselben Aufgaben wie in der Familienansicht, nur größer. */
export function PersonPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { memberId } = useParams()
  const { members, today, isPending, error, refetch } = useFamilyToday()
  useIdleTimeout(PERSON_IDLE_TIMEOUT_MS, () => navigate('/'))

  if (isPending) {
    return (
      <p role="status" className="p-6 text-xl text-slate-600">
        {t('common.loading')}
      </p>
    )
  }
  if (!members || !today) {
    return (
      <div className="flex flex-col items-start gap-4 p-6">
        <Alert>{errorMessage(t, error)}</Alert>
        <Button onClick={() => void refetch()}>{t('actions.retry')}</Button>
      </div>
    )
  }

  const member = members.find((candidate) => String(candidate.id) === memberId)
  if (!member) return <Navigate to="/" replace />
  const tasks = tasksFor(today.tasks, member.id)
  const points = pointsFor(today, member.id)

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex items-center gap-4">
        <Link
          to="/"
          aria-label={t('family.back')}
          className="flex size-20 shrink-0 items-center justify-center rounded-3xl bg-white shadow-sm hover:bg-orange-100 focus-visible:outline-4 focus-visible:outline-orange-400"
        >
          <BackIcon className="size-12" aria-hidden="true" />
        </Link>
        <Avatar name={member.name} color={member.color} src={member.avatar_url} size="xl" />
        <h1 className="min-w-0 text-4xl font-extrabold break-words text-slate-800">
          {member.name}
        </h1>
      </header>
      <DayProgress
        member={member}
        tasks={currentTasks(tasks, member.id, today.date)}
        points={points}
        care={careShares(members, today)}
        size="lg"
      />
      <TaskGroups
        member={member}
        tasks={tasks}
        date={today.date}
        currentTimeOfDay={today.time_of_day}
        size="lg"
      />
      {member.role === 'child' && (
        <section aria-labelledby="person-rewards" className="flex flex-col gap-4 pt-4">
          <h2
            id="person-rewards"
            className="flex items-center gap-3 text-3xl font-extrabold text-slate-800"
          >
            <GiftIcon className="size-12" aria-hidden="true" />
            {t('rewards.title')}
          </h2>
          <RewardGrid member={member} balance={points.total} />
        </section>
      )}
    </main>
  )
}
