import { useTranslation } from 'react-i18next'
import TrophyIcon from '~icons/fluent-emoji-flat/trophy'

import type { Member } from '../../api/members'
import { type Today, pointsFor } from '../../api/today'
import { Avatar } from '../../components/Avatar'
import { Alert, Section } from '../../components/ui'
import { errorMessage } from '../../errors'

interface PointsSectionProps {
  members: Member[]
  today: Today | undefined
  error: unknown
  onOpen: (member: Member) => void
}

/** Punktestände aller Personen; ein Tipp öffnet Historie und manuelle Buchung. */
export function PointsSection({ members, today, error, onOpen }: PointsSectionProps) {
  const { t } = useTranslation()

  return (
    <Section title={t('points.section')}>
      {error ? <Alert>{errorMessage(t, error)}</Alert> : null}
      {members.length === 0 ? (
        <p className="text-lg text-slate-600">{t('points.need_members')}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {members.map((member) => {
            const total = today ? pointsFor(today, member.id).total : null
            return (
              <li key={member.id}>
                <button
                  type="button"
                  onClick={() => onOpen(member)}
                  aria-label={t('points.open', { name: member.name })}
                  className="flex w-full flex-col items-center gap-2 rounded-2xl p-3 text-center transition-colors hover:bg-orange-50 focus-visible:outline-4 focus-visible:outline-orange-400 active:bg-orange-100"
                >
                  <Avatar name={member.name} color={member.color} src={member.avatar_url} />
                  <span className="text-lg font-bold break-words text-slate-800">
                    {member.name}
                  </span>
                  <span className="flex items-center gap-1 text-xl font-extrabold text-slate-700 tabular-nums">
                    <TrophyIcon className="size-7" aria-hidden="true" />
                    {total ?? '–'}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Section>
  )
}
