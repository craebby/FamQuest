import { useTranslation } from 'react-i18next'
import ScaleIcon from '~icons/fluent-emoji-flat/balance-scale'

import { Avatar } from '../../components/Avatar'
import type { CareSegment } from '../../care'
import { colorTokens } from '../../memberColors'

interface ChoreShareProps {
  /** Anteile aller Beteiligten (siehe careShares). */
  shares: CareSegment[]
  /** So viele Tage zählt die Verteilung zurück. */
  days: number
  /** Kompakt: nur Balken und Avatare mit Prozent, für die Spalte unter „Aufgaben“. */
  compact?: boolean
}

/**
 * Faire Verteilung: wer wie viel vom Putzplan erledigt hat, als geteilter Balken in den
 * Personenfarben. Kein Wettbewerb, sondern ein Blick darauf, wie sich die Arbeit verteilt.
 */
export function ChoreShare({ shares, days, compact = false }: ChoreShareProps) {
  const { t } = useTranslation()
  const legend = (share: CareSegment) =>
    t('care.legend', { name: share.member.name, percent: share.percent, count: share.done })
  const period = t('care.period', { days })

  const bar = (
    <span
      role="img"
      aria-label={`${t('care.title')} (${period}): ${shares.map(legend).join('; ')}`}
      className={`flex w-full overflow-hidden rounded-full bg-slate-200 shadow-inner ${compact ? 'h-3' : 'h-6'}`}
    >
      {shares.map((share) => (
        <span
          key={share.member.id}
          className="block h-full transition-[width] duration-500 motion-reduce:transition-none"
          style={{
            width: `${share.percent}%`,
            backgroundColor: colorTokens(share.member.color).main,
          }}
        />
      ))}
    </span>
  )

  if (compact) {
    return (
      <div className="flex w-full max-w-72 flex-col gap-1">
        {bar}
        <ul
          aria-hidden="true"
          className="flex h-9 flex-wrap justify-center gap-x-3 overflow-hidden"
        >
          {shares.map((share) => (
            <li key={share.member.id} className="flex items-center gap-1">
              <Avatar
                name={share.member.name}
                color={share.member.color}
                src={share.member.avatar_url}
                size="xs"
              />
              <span className="text-base font-extrabold text-slate-700 tabular-nums">
                {t('care.percent', { percent: share.percent })}
              </span>
            </li>
          ))}
        </ul>
      </div>
    )
  }
  return (
    <section
      aria-labelledby="chore-share-title"
      className="flex flex-col gap-3 rounded-3xl bg-white p-4 shadow-sm"
    >
      <h2 id="chore-share-title" className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <ScaleIcon className="size-9 shrink-0" aria-hidden="true" />
        <span className="text-2xl font-extrabold text-slate-800">{t('care.title')}</span>
        <span className="text-lg font-bold text-slate-500">{period}</span>
      </h2>
      {bar}
      <ul className="flex flex-wrap gap-x-6 gap-y-2">
        {shares.map((share) => (
          <li key={share.member.id} className="flex items-center gap-2">
            <Avatar
              name={share.member.name}
              color={share.member.color}
              src={share.member.avatar_url}
              size="sm"
            />
            <span className="sr-only">{legend(share)}</span>
            <span aria-hidden="true" className="flex flex-col leading-tight">
              <span className="text-lg font-extrabold text-slate-800">{share.member.name}</span>
              <span className="text-base font-bold text-slate-600 tabular-nums">
                {t('care.percent', { percent: share.percent })} ·{' '}
                {t('care.count', { count: share.done })}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
