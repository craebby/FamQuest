import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import EggIcon from '~icons/fluent-emoji-flat/egg'

import { companionFor, useCompanions } from '../../api/companions'
import type { Member } from '../../api/members'
import type { Today } from '../../api/today'
import { HeartIcon, SPECIES_ICONS, SPECIES_STYLE } from './icons'
import { feeding } from './feeding'

/**
 * Das Tier klein neben dem Kind in „Aufgaben“: Jede erledigte Aufgabe lässt es sofort hüpfen
 * (mit Herz). Ohne ausgesuchtes Tier wackelt ein Ei und lädt zum Aussuchen ein.
 */
export function CompanionBadge({
  member,
  today,
  className = '',
}: {
  member: Member
  today: Today
  className?: string
}) {
  const { t } = useTranslation()
  const companion = companionFor(useCompanions().data, member.id)
  const { food } = feeding(today, member.id)
  const last = useRef(food)
  const [hop, setHop] = useState(0)

  useEffect(() => {
    if (food > last.current) setHop((value) => value + 1)
    last.current = food
  }, [food])

  if (member.companion_mode === 'rewards' || !companion) return null
  const Animal = companion.species ? SPECIES_ICONS[companion.species] : EggIcon
  const small = companion.stage === 'egg' || companion.stage === 'baby'

  return (
    <Link
      to={`/companion/${member.id}`}
      aria-label={t('companion.of', { name: member.name })}
      className={`flex size-16 items-end justify-center rounded-3xl focus-visible:outline-4 focus-visible:outline-orange-400 ${className}`}
    >
      <span key={hop} className={`relative ${hop > 0 ? 'animate-pet-hop' : ''}`}>
        <Animal
          aria-hidden="true"
          className={small ? 'size-10' : 'size-14'}
          style={companion.species ? SPECIES_STYLE[companion.species] : undefined}
        />
        {hop > 0 && (
          <HeartIcon
            aria-hidden="true"
            className="absolute -top-4 left-1/2 size-7 -translate-x-1/2 animate-float-up"
          />
        )}
      </span>
    </Link>
  )
}
