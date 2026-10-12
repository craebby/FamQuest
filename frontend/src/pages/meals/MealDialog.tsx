import { useState } from 'react'

import { type Meal, type MealEntry, hasRecipe, useDishes, useFillMeals } from '../../api/meals'
import { MealEditor } from './MealEditor'
import { RecipeView } from './RecipeView'

/**
 * Tipp auf eine Mahlzeit im Plan: Hat das geplante Gericht ein Rezept, erscheint zuerst das
 * Rezept (zum Mitkochen); „Anderes Gericht“ führt zum Eintragen. Sonst geht es gleich zum
 * Eintragen, wo der Knopf „Rezept“ zum (noch leeren) Rezept führt. Ab heute lässt sich ein Tag
 * im Rezept „neu würfeln“: ein anderes Gericht aus der Rezeptsammlung.
 */
export function MealDialog({
  date,
  meal,
  title,
  entry,
  onClose,
  upcoming = false,
}: {
  date: string
  meal: Meal
  title: string
  entry: MealEntry | undefined
  onClose: () => void
  /** Liegt der Tag heute oder später? Nur dann gibt es „Neu würfeln“. */
  upcoming?: boolean
}) {
  const dishes = useDishes()
  const dish = entry && dishes.data?.find((candidate) => candidate.id === entry.dish_id)
  const [mode, setMode] = useState<'auto' | 'edit' | 'recipe'>('auto')
  const fill = useFillMeals()
  // Bis die Gerichte da sind, ist unklar, ob es ein Rezept gibt; das dauert nur einen Augenblick.
  if (mode === 'auto' && entry && dishes.isPending) return null
  const shown = mode === 'auto' ? (dish && hasRecipe(dish) ? 'recipe' : 'edit') : mode

  if (shown === 'recipe' && entry) {
    return (
      <RecipeView
        dishId={entry.dish_id}
        onClose={onClose}
        onChangeMeal={() => setMode('edit')}
        reroll={
          upcoming
            ? {
                run: () =>
                  fill.mutate(
                    { start: date, end: date, meal, replace: true },
                    { onSuccess: () => setMode('recipe') },
                  ),
                busy: fill.isPending,
                error: fill.error,
              }
            : undefined
        }
      />
    )
  }
  return (
    <MealEditor
      date={date}
      meal={meal}
      title={title}
      entry={entry}
      onClose={onClose}
      onRecipe={entry ? () => setMode('recipe') : undefined}
    />
  )
}
