import { useTranslation } from 'react-i18next'
import MemoIcon from '~icons/fluent-emoji-flat/memo'

import type { MealEntry } from '../../api/meals'

/**
 * Zeigt unter einem geplanten Gericht, dass es an diesem Tag eine Variante gibt: Notizblock mit
 * der Notiz, ohne Notiz „angepasst“. `compact` kürzt die Notiz auf eine Zeile.
 */
export function VariantMark({ entry, compact = false }: { entry: MealEntry; compact?: boolean }) {
  const { t } = useTranslation()
  if (!entry.note && !entry.variant) return null
  return (
    <span
      className={`flex min-w-0 items-center gap-1 text-sm leading-tight font-semibold text-amber-700 ${compact ? '' : 'lg:justify-center'}`}
    >
      <MemoIcon className="size-5 shrink-0" aria-hidden="true" />
      <span className={`min-w-0 break-words ${compact ? 'line-clamp-1' : 'line-clamp-2'}`}>
        {entry.note ?? t('meals.variant')}
      </span>
    </span>
  )
}
