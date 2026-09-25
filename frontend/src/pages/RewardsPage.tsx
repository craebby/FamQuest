import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import BackIcon from '~icons/fluent-emoji-flat/left-arrow'
import TrophyIcon from '~icons/fluent-emoji-flat/trophy'
import GiftIcon from '~icons/fluent-emoji-flat/wrapped-gift'

import { childrenOf } from '../api/members'
import { pointsFor } from '../api/today'
import { Avatar } from '../components/Avatar'
import { Alert, Button } from '../components/ui'
import { errorMessage } from '../errors'
import { useIdleTimeout } from '../useIdleTimeout'
import { PERSON_IDLE_TIMEOUT_MS } from './PersonPage'
import { useFamilyToday } from './family/useFamilyToday'
import { RewardGrid } from './rewards/RewardGrid'

function Balance({ total, size }: { total: number; size: 'md' | 'lg' }) {
  const { t } = useTranslation()
  return (
    <span className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2 shadow-sm">
      <TrophyIcon className={size === 'lg' ? 'size-12' : 'size-8'} aria-hidden="true" />
      <span className="sr-only">{t('points.total_label', { count: total })}</span>
      <span
        aria-hidden="true"
        className={`font-extrabold text-slate-800 tabular-nums ${size === 'lg' ? 'text-4xl' : 'text-2xl'}`}
      >
        {total}
      </span>
    </span>
  )
}

/** Geschenk in der Navigation: erst das Kind antippen, dann seine Belohnungen. */
export function RewardsPage() {
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

  const children = childrenOf(members)

  if (memberId !== undefined) {
    const member = children.find((candidate) => String(candidate.id) === memberId)
    if (!member) return <Navigate to="/rewards" replace />
    const total = pointsFor(today, member.id).total
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-6">
        <header className="flex flex-wrap items-center gap-4">
          <Link
            to="/rewards"
            aria-label={t('rewards.back')}
            className="flex size-20 shrink-0 items-center justify-center rounded-3xl bg-white shadow-sm hover:bg-orange-100 focus-visible:outline-4 focus-visible:outline-orange-400"
          >
            <BackIcon className="size-12" aria-hidden="true" />
          </Link>
          <Avatar name={member.name} color={member.color} src={member.avatar_url} size="lg" />
          <h1 className="min-w-0 flex-1 text-4xl font-extrabold break-words text-slate-800">
            <span className="sr-only">{t('rewards.of', { name: member.name })}</span>
            <span aria-hidden="true">{member.name}</span>
          </h1>
          <Balance total={total} size="lg" />
        </header>
        <RewardGrid member={member} balance={total} />
      </main>
    )
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <h1 className="flex items-center gap-3 text-3xl font-extrabold text-orange-600">
        <GiftIcon className="size-12" aria-hidden="true" />
        {t('rewards.title')}
      </h1>
      {children.length === 0 ? (
        <p className="text-xl text-slate-600">{t('rewards.no_children')}</p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-4">
          {children.map((member) => (
            <li key={member.id}>
              <Link
                to={`/rewards/${member.id}`}
                aria-label={t('rewards.of', { name: member.name })}
                className="flex flex-col items-center gap-3 rounded-3xl bg-white p-4 shadow-sm transition-transform focus-visible:outline-4 focus-visible:outline-orange-400 active:scale-95 motion-reduce:active:scale-100"
              >
                <Avatar name={member.name} color={member.color} src={member.avatar_url} size="lg" />
                <span className="text-2xl font-extrabold break-words text-slate-800">
                  {member.name}
                </span>
                <Balance total={pointsFor(today, member.id).total} size="md" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
