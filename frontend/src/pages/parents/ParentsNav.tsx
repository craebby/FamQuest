import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import MoreIcon from '~icons/lucide/ellipsis'

import { AREA_ICONS, PARENT_AREAS, PRIMARY_AREAS, type ParentArea, areaPath } from './areas'

interface ParentsNavProps {
  area: ParentArea
  /** Erledigungen, die auf die Kontrolle warten; rote Zahl an „Prüfen & Punkte“. */
  pending: number
}

function Badge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span
      aria-hidden="true"
      className="absolute -top-2 -right-3 flex min-w-7 items-center justify-center rounded-full bg-red-600 px-1.5 text-base leading-7 font-extrabold text-white ring-2 ring-white"
    >
      {count}
    </span>
  )
}

/**
 * Menü des Elternbereichs: auf Tablet und Display als Leiste links mit allen Bereichen,
 * am Handy unten mit den vier wichtigsten Bereichen und „Mehr“ für den Rest.
 */
export function ParentsNav({ area, pending }: ParentsNavProps) {
  const { t } = useTranslation()
  const [moreOpen, setMoreOpen] = useState(false)
  const secondary = PARENT_AREAS.filter((candidate) => !PRIMARY_AREAS.includes(candidate))

  useEffect(() => {
    if (!moreOpen) return
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreOpen(false)
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [moreOpen])

  const label = (candidate: ParentArea) => t(`parents_nav.${candidate}`)
  const ariaLabel = (candidate: ParentArea) =>
    candidate === 'review' && pending > 0
      ? `${label(candidate)}, ${t('nav.pending', { count: pending })}`
      : label(candidate)

  return (
    <>
      {/* Tablet und Display: alle Bereiche untereinander. */}
      <nav
        aria-label={t('parents_nav.label')}
        className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-1 overflow-y-auto border-r border-orange-100 bg-white p-3 md:flex"
      >
        {PARENT_AREAS.map((candidate) => {
          const Icon = AREA_ICONS[candidate]
          return (
            <Link
              key={candidate}
              to={areaPath(candidate)}
              aria-current={candidate === area ? 'page' : undefined}
              aria-label={ariaLabel(candidate)}
              className="flex min-h-16 items-center gap-3 rounded-2xl px-3 py-2 text-lg font-bold text-slate-700 hover:bg-orange-50 focus-visible:outline-4 focus-visible:outline-orange-400 aria-[current=page]:bg-orange-100 aria-[current=page]:text-orange-800"
            >
              <span className="relative shrink-0">
                <Icon className="size-9" aria-hidden="true" />
                {candidate === 'review' && <Badge count={pending} />}
              </span>
              {label(candidate)}
            </Link>
          )
        })}
      </nav>

      {/* Handy: unten die wichtigsten Bereiche und „Mehr“. */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-20 bg-slate-900/30 md:hidden"
          onClick={() => setMoreOpen(false)}
          aria-hidden="true"
        />
      )}
      <nav
        aria-label={t('parents_nav.label')}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-orange-100 bg-white/95 p-2 backdrop-blur md:hidden"
      >
        {moreOpen && (
          <ul
            id="parents-more"
            className="mb-2 flex flex-col gap-1 rounded-2xl bg-white p-1 shadow-lg ring-1 ring-slate-200"
          >
            {secondary.map((candidate) => {
              const Icon = AREA_ICONS[candidate]
              return (
                <li key={candidate}>
                  <Link
                    to={areaPath(candidate)}
                    aria-current={candidate === area ? 'page' : undefined}
                    onClick={() => setMoreOpen(false)}
                    className="flex min-h-14 items-center gap-3 rounded-xl px-3 text-lg font-bold text-slate-700 hover:bg-orange-50 focus-visible:outline-4 focus-visible:outline-orange-400 aria-[current=page]:bg-orange-100 aria-[current=page]:text-orange-800"
                  >
                    <Icon className="size-8 shrink-0" aria-hidden="true" />
                    {label(candidate)}
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
        <div className="grid grid-cols-5 gap-1">
          {PRIMARY_AREAS.map((candidate) => {
            const Icon = AREA_ICONS[candidate]
            return (
              <Link
                key={candidate}
                to={areaPath(candidate)}
                aria-current={candidate === area ? 'page' : undefined}
                aria-label={ariaLabel(candidate)}
                onClick={() => setMoreOpen(false)}
                className="flex min-h-18 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1 text-center text-xs leading-tight font-bold text-slate-600 hover:bg-orange-50 focus-visible:outline-4 focus-visible:outline-orange-400 aria-[current=page]:bg-orange-100 aria-[current=page]:text-orange-800"
              >
                <span className="relative">
                  <Icon className="size-8" aria-hidden="true" />
                  {candidate === 'review' && <Badge count={pending} />}
                </span>
                <span className="max-w-full break-words hyphens-auto">
                  {candidate === 'review' ? t('parents_nav.review_short') : label(candidate)}
                </span>
              </Link>
            )
          })}
          <button
            type="button"
            aria-expanded={moreOpen}
            aria-controls="parents-more"
            onClick={() => setMoreOpen((open) => !open)}
            className={`flex min-h-18 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1 text-xs leading-tight font-bold hover:bg-orange-50 focus-visible:outline-4 focus-visible:outline-orange-400 ${
              moreOpen || secondary.includes(area)
                ? 'bg-orange-100 text-orange-800'
                : 'text-slate-600'
            }`}
          >
            <MoreIcon className="size-8" aria-hidden="true" />
            {t('parents_nav.more')}
          </button>
        </div>
      </nav>
    </>
  )
}
