import type { TFunction } from 'i18next'

import type { MealEntry } from '../../api/meals'

/** Vorlesetext einer geplanten Mahlzeit, mit Notiz bzw. Hinweis auf die Variante. */
export function entryLabel(t: TFunction, meal: string, entry: MealEntry) {
  const label = t('meals.edit_label', { meal, dish: entry.name })
  if (entry.note) return t('meals.label_with_note', { label, note: entry.note })
  return entry.variant ? t('meals.label_with_variant', { label }) : label
}
