import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import GlowingStarIcon from '~icons/fluent-emoji-flat/glowing-star'
import StarIcon from '~icons/fluent-emoji-flat/star'
import TrophyIcon from '~icons/fluent-emoji-flat/trophy'

import type { Member } from '../../api/members'
import type { MemberPoints, TodayTask } from '../../api/today'
import { colorTokens } from '../../memberColors'

/** Bis zu so vielen Aufgaben zeigt der Fortschritt Sterne, darüber einen Balken. */
export const MAX_STARS = 8

const SIZES = {
  md: { star: 'size-7', icon: 'size-8', number: 'text-2xl', label: 'text-sm', bar: 'h-4' },
  lg: { star: 'size-10', icon: 'size-11', number: 'text-4xl', label: 'text-base', bar: 'h-6' },
} as const

interface DayProgressProps {
  member: Member
  /** Heutige Aufgaben dieser Person. */
  tasks: TodayTask[]
  points: MemberPoints
  size: 'md' | 'lg'
}

/** Tagesfortschritt als Sterne-Reihe, heute verdiente Punkte und Punktestand einer Person. */
export function DayProgress({ member, tasks, points, size }: DayProgressProps) {
  const { t } = useTranslation()
  const tokens = colorTokens(member.color)
  const sizes = SIZES[size]
  const total = tasks.length
  const done = tasks.filter((task) => task.done_member_ids.includes(member.id)).length

  return (
    <div className="flex flex-col items-center gap-2">
      {total > 0 && (
        <div
          role="img"
          aria-label={t('points.progress', { done, total })}
          className="flex w-full flex-wrap items-center justify-center gap-0.5"
        >
          {total <= MAX_STARS ? (
            Array.from({ length: total }, (_, index) => (
              <StarIcon
                key={index}
                className={`${sizes.star} ${index < done ? '' : 'opacity-25 grayscale'}`}
                aria-hidden="true"
              />
            ))
          ) : (
            <span
              className={`w-full max-w-64 overflow-hidden rounded-full bg-white shadow-inner ${sizes.bar}`}
              aria-hidden="true"
            >
              <span
                className="block h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none"
                style={{ width: `${(done / total) * 100}%`, backgroundColor: tokens.main }}
              />
            </span>
          )}
        </div>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        <PointsBadge
          icon={<GlowingStarIcon className={sizes.icon} aria-hidden="true" />}
          value={points.today}
          caption={t('points.today')}
          label={t('points.today_label', { count: points.today })}
          background={tokens.soft}
          sizes={sizes}
        />
        <PointsBadge
          icon={<TrophyIcon className={sizes.icon} aria-hidden="true" />}
          value={points.total}
          caption={t('points.total')}
          label={t('points.total_label', { count: points.total })}
          background="#ffffff"
          sizes={sizes}
        />
      </div>
    </div>
  )
}

function PointsBadge({
  icon,
  value,
  caption,
  label,
  background,
  sizes,
}: {
  icon: ReactNode
  value: number
  caption: string
  label: string
  background: string
  sizes: (typeof SIZES)[keyof typeof SIZES]
}) {
  return (
    <p
      className="flex items-center gap-2 rounded-2xl px-3 py-1 shadow-sm"
      style={{ backgroundColor: background }}
    >
      <span className="sr-only">{label}</span>
      {icon}
      <span aria-hidden="true" className="flex flex-col leading-none">
        <span className={`font-extrabold text-slate-800 tabular-nums ${sizes.number}`}>
          {value}
        </span>
        <span className={`font-bold text-slate-600 ${sizes.label}`}>{caption}</span>
      </span>
    </p>
  )
}
