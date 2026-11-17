import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import BackIcon from '~icons/fluent-emoji-flat/left-arrow'
import PawIcon from '~icons/fluent-emoji-flat/paw-prints'
import TrophyIcon from '~icons/fluent-emoji-flat/trophy'

import { type Companions, companionFor, useCompanions } from '../api/companions'
import type { Member } from '../api/members'
import { type Today, pointsFor } from '../api/today'
import { Avatar } from '../components/Avatar'
import { Alert, Button } from '../components/ui'
import { errorMessage } from '../errors'
import { useIdleTimeout } from '../useIdleTimeout'
import { PERSON_IDLE_TIMEOUT_MS } from './PersonPage'
import { ChooseAnimal } from './companion/ChooseAnimal'
import { Habitat } from './companion/Habitat'
import { CompanionFigure } from './companion/art'
import { useFamilyToday } from './family/useFamilyToday'
import { companionChildren, feeding } from './companion/feeding'

/** Pfote in der Navigation: das Tier des Kindes, bei mehreren Kindern erst das Kind antippen. */
export function CompanionPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { memberId } = useParams()
  const { members, today, isPending, error, refetch } = useFamilyToday()
  const companions = useCompanions()
  useIdleTimeout(PERSON_IDLE_TIMEOUT_MS, () => navigate('/'))

  if (isPending || companions.isPending) {
    return (
      <p role="status" className="p-6 text-xl text-slate-600">
        {t('common.loading')}
      </p>
    )
  }
  if (!members || !today || !companions.data) {
    return (
      <div className="flex flex-col items-start gap-4 p-6">
        <Alert>{errorMessage(t, error ?? companions.error)}</Alert>
        <Button
          onClick={() => {
            void refetch()
            void companions.refetch()
          }}
        >
          {t('actions.retry')}
        </Button>
      </div>
    )
  }

  const children = companionChildren(members)
  // Nur ein Kind: gleich sein Tier.
  const id = memberId ?? (children.length === 1 ? String(children[0].id) : undefined)

  if (id !== undefined) {
    const member = children.find((candidate) => String(candidate.id) === id)
    if (!member) return <Navigate to="/companion" replace />
    return (
      <ChildCompanion
        member={member}
        today={today}
        data={companions.data}
        showBack={children.length > 1}
      />
    )
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <h1 className="flex items-center gap-3 text-3xl font-extrabold text-orange-600">
        <PawIcon className="size-12" aria-hidden="true" />
        {t('companion.title')}
      </h1>
      {children.length === 0 ? (
        <p className="text-xl text-slate-600">{t('companion.no_children')}</p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-4">
          {children.map((member) => {
            const companion = companionFor(companions.data, member.id)
            return (
              <li key={member.id}>
                <Link
                  to={`/companion/${member.id}`}
                  aria-label={t('companion.of', { name: member.name })}
                  className="flex flex-col items-center gap-2 rounded-3xl bg-white p-4 shadow-sm transition-transform focus-visible:outline-4 focus-visible:outline-orange-400 active:scale-95 motion-reduce:active:scale-100"
                >
                  <Avatar name={member.name} color={member.color} src={member.avatar_url} />
                  <div className="w-40">
                    {companion?.species ? (
                      <CompanionFigure
                        species={companion.species}
                        stage={companion.stage}
                        careDays={companion.care_days}
                        equipped={companion.equipped}
                        mood={feeding(today, member.id).food > 0 ? 'happy' : 'sleepy'}
                      />
                    ) : (
                      <PawIcon className="mx-auto size-24 opacity-40" aria-hidden="true" />
                    )}
                  </div>
                  <span className="text-2xl font-extrabold break-words text-slate-800">
                    {member.name}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}

function ChildCompanion({
  member,
  today,
  data,
  showBack,
}: {
  member: Member
  today: Today
  data: Companions
  showBack: boolean
}) {
  const { t } = useTranslation()
  const companion = companionFor(data, member.id)
  const balance = pointsFor(today, member.id).total
  const { food, allDone } = feeding(today, member.id)
  const species = companion?.species

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center gap-4">
        {showBack && (
          <Link
            to="/companion"
            aria-label={t('companion.back')}
            className="flex size-20 shrink-0 items-center justify-center rounded-3xl bg-white shadow-sm hover:bg-orange-100 focus-visible:outline-4 focus-visible:outline-orange-400"
          >
            <BackIcon className="size-12" aria-hidden="true" />
          </Link>
        )}
        <Avatar name={member.name} color={member.color} src={member.avatar_url} size="lg" />
        <h1 className="min-w-0 flex-1 text-4xl font-extrabold break-words text-slate-800">
          <span className="sr-only">{t('companion.of', { name: member.name })}</span>
          <span aria-hidden="true">{member.name}</span>
        </h1>
        <span className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2 shadow-sm">
          <TrophyIcon className="size-12" aria-hidden="true" />
          <span className="sr-only">{t('points.total_label', { count: balance })}</span>
          <span aria-hidden="true" className="text-4xl font-extrabold text-slate-800 tabular-nums">
            {balance}
          </span>
        </span>
      </header>
      {companion && species ? (
        <Habitat
          member={member}
          companion={{ ...companion, species }}
          items={data.items}
          date={today.date}
          food={food}
          allDone={allDone}
          balance={balance}
        />
      ) : (
        <ChooseAnimal member={member} species={data.species} />
      )}
    </main>
  )
}
