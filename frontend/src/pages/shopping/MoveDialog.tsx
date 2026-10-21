import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import CloseIcon from '~icons/lucide/x'

import type { ListItem } from '../../api/shopping'
import { TaskIcon } from '../../components/TaskIcon'
import { Button } from '../../components/ui'
import { AreaIcon } from './AreaIcon'
import { type Area, SUPERMARKET_AREAS, autoArea, itemArea } from './areas'

const OTHER_STORES: readonly Area[] = ['drugstore', 'hardware', 'online']

interface MoveDialogProps {
  item: ListItem
  /** null: wieder automatisch zuordnen (der gewählte Bereich ist der automatische). */
  onMove: (area: Area | null) => void
  onClose: () => void
}

/** Wohin gehört der Artikel? Große Knöpfe mit Symbol je Bereich im Supermarkt und je Laden. */
export function MoveDialog({ item, onMove, onClose }: MoveDialogProps) {
  const { t } = useTranslation()
  const dialog = useRef<HTMLDivElement>(null)
  const current = itemArea(item)

  useEffect(() => {
    dialog.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Der automatische Bereich bleibt automatisch, so greifen spätere Regeln weiter.
  const choose = (area: Area) => onMove(area === autoArea(item.name, item.icon) ? null : area)

  const choices = (areas: readonly Area[]) => (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-2">
      {areas.map((area) => (
        <li key={area}>
          <button
            type="button"
            aria-pressed={area === current}
            onClick={() => choose(area)}
            className="flex h-full w-full flex-col items-center gap-1 rounded-2xl p-2 text-center text-base leading-tight font-bold text-slate-700 ring-2 ring-slate-100 hover:bg-orange-50 focus-visible:outline-4 focus-visible:outline-orange-400 active:bg-orange-100 aria-pressed:bg-emerald-50 aria-pressed:ring-4 aria-pressed:ring-emerald-500"
          >
            <AreaIcon area={area} className="size-12" />
            {t(`shopping.area.${area}`)}
          </button>
        </li>
      ))}
    </ul>
  )

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shopping-move-title"
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/80 p-2 sm:p-4"
    >
      <div
        ref={dialog}
        tabIndex={-1}
        className="flex max-h-full w-full max-w-3xl flex-col gap-4 overflow-y-auto rounded-3xl bg-white p-4 outline-none sm:p-6"
      >
        <div className="flex items-center gap-3">
          <TaskIcon icon={item.icon} className="size-12" />
          <h2 id="shopping-move-title" className="text-2xl font-extrabold text-slate-800">
            {t('shopping.move_title', { name: item.name })}
          </h2>
          <Button
            variant="secondary"
            className="ml-auto"
            onClick={onClose}
            aria-label={t('shopping.close')}
          >
            <CloseIcon className="size-7" aria-hidden="true" />
          </Button>
        </div>
        <h3 className="flex items-center gap-2 text-xl font-extrabold text-slate-600">
          <AreaIcon area="supermarket" className="size-8" />
          {t('shopping.store.supermarket')}
        </h3>
        {choices(SUPERMARKET_AREAS)}
        <h3 className="text-xl font-extrabold text-slate-600">{t('shopping.other_stores')}</h3>
        {choices(OTHER_STORES)}
      </div>
    </div>
  )
}
