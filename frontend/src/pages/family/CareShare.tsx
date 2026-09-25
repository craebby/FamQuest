import { useTranslation } from 'react-i18next'
import ScaleIcon from '~icons/fluent-emoji-flat/balance-scale'

import type { Member } from '../../api/members'
import type { CareSegment } from '../../care'
import { colorTokens } from '../../memberColors'

interface CareShareProps {
  member: Member
  /** Anteile aller Erwachsenen (siehe careShares). */
  shares: CareSegment[]
  size: 'md' | 'lg'
}

/**
 * Anteil eines Erwachsenen an den diese Woche erledigten Aufgaben aller Erwachsenen,
 * als geteilter Balken in den Personenfarben. Kein Wettbewerb, sondern Blick auf die Verteilung.
 */
export function CareShare({ member, shares, size }: CareShareProps) {
  const { t } = useTranslation()
  const own = shares.find((share) => share.member.id === member.id)
  if (!own) return null
  const anyDone = shares.some((share) => share.done > 0)

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <span
        role="img"
        aria-label={t('care.label', { percent: own.percent, count: own.done })}
        className={`flex w-full max-w-64 overflow-hidden rounded-full bg-slate-200 shadow-inner ${size === 'lg' ? 'h-7' : 'h-5'}`}
      >
        {anyDone &&
          shares.map((share) => (
            <span
              key={share.member.id}
              className={`block h-full transition-[width] duration-500 motion-reduce:transition-none ${share.member.id === member.id ? '' : 'opacity-35'}`}
              style={{
                width: `${share.percent}%`,
                backgroundColor: colorTokens(share.member.color).main,
              }}
            />
          ))}
      </span>
      <p
        className="flex items-center gap-2 rounded-2xl bg-white px-3 py-1 shadow-sm"
        aria-hidden="true"
      >
        <ScaleIcon className={size === 'lg' ? 'size-11' : 'size-8'} />
        <span className="flex flex-col leading-none">
          <span
            className={`font-extrabold text-slate-800 tabular-nums ${size === 'lg' ? 'text-4xl' : 'text-2xl'}`}
          >
            {anyDone ? t('care.percent', { percent: own.percent }) : '–'}
          </span>
          <span className={`font-bold text-slate-600 ${size === 'lg' ? 'text-base' : 'text-sm'}`}>
            {t('care.this_week')}
          </span>
        </span>
      </p>
      {size === 'lg' && anyDone && (
        <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-lg font-bold text-slate-700">
          {shares.map((share) => (
            <li key={share.member.id} className="flex items-center gap-2">
              <span
                className="size-4 rounded-full"
                style={{ backgroundColor: colorTokens(share.member.color).main }}
                aria-hidden="true"
              />
              {t('care.legend', {
                name: share.member.name,
                percent: share.percent,
                count: share.done,
              })}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
