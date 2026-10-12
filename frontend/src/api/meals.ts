import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, apiGet } from './client'
import { useParentMutation } from './mutations'

/** Mahlzeiten in zeitlicher Reihenfolge; dieselbe Liste wie im Backend (schemas.MEALS). */
export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const
export type Meal = (typeof MEALS)[number]

export interface MealSettings {
  /** Geplante Mahlzeiten; Standard ist nur das Abendessen. */
  meals: Meal[]
}

export interface Dish {
  id: number
  name: string
  icon: string
  /** Eigenes Foto; ersetzt in der Anzeige das Symbol. */
  image_url: string | null
  /** Wann zuletzt im Plan (ISO-Datum) und wie oft; für die Vorschläge. */
  last_planned: string | null
  times_planned: number
  /** Rezept: Zutaten und Schritte, je ein Text; beide leer = kein Rezept. */
  ingredients: string[]
  steps: string[]
  /** Für wie viele Portionen die Mengen gelten; ohne Angabe null. */
  servings: number | null
  /** 1 bis 5 Sterne; ohne Bewertung null. */
  rating: number | null
}

/** Ein Rezept, wie es eingefügt wird (zerlegt aus einem Text). */
export interface RecipeData {
  name: string
  icon: string
  ingredients: string[]
  steps: string[]
  servings: number | null
}

export const hasRecipe = (dish: Pick<Dish, 'ingredients' | 'steps'>) =>
  dish.ingredients.length > 0 || dish.steps.length > 0

export interface MealEntry {
  date: string
  meal: Meal
  dish_id: number
  name: string
  icon: string
  image_url: string | null
}

export interface MealWeek {
  start: string
  today: string
  meals: Meal[]
  entries: MealEntry[]
}

export const MEAL_SETTINGS_KEY = ['meal-settings'] as const
export const MEAL_WEEK_KEY = ['meal-week'] as const
export const DISHES_KEY = ['dishes'] as const

export function useMealSettings() {
  return useQuery({
    queryKey: MEAL_SETTINGS_KEY,
    queryFn: () => apiGet<MealSettings>('/meals/settings'),
  })
}

export const useSaveMealSettings = () =>
  useParentMutation(
    (settings: MealSettings) => api<MealSettings>('PUT', '/meals/settings', settings),
    [MEAL_SETTINGS_KEY, MEAL_WEEK_KEY],
  )

/** Essensplan einer Woche; `offset` 0 = aktuelle Woche. Plant jemand am Handy, zieht das Display nach. */
export function useMealWeek(offset: number, enabled = true) {
  return useQuery({
    enabled,
    queryKey: [...MEAL_WEEK_KEY, offset],
    queryFn: () => apiGet<MealWeek>(`/meals/week?offset=${offset}`),
    refetchInterval: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  })
}

export function useDishes() {
  return useQuery({ queryKey: DISHES_KEY, queryFn: () => apiGet<Dish[]>('/dishes') })
}

/** Gericht eintragen oder entfernen (`name` null); im Alltag ohne Eltern-PIN. */
export function usePlanMeal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      date,
      meal,
      dish,
    }: {
      date: string
      meal: Meal
      dish: { name: string; icon: string } | null
    }) =>
      dish
        ? api<MealEntry>('PUT', `/meals/${date}/${meal}`, dish)
        : api<null>('DELETE', `/meals/${date}/${meal}`),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: MEAL_WEEK_KEY }),
        queryClient.invalidateQueries({ queryKey: DISHES_KEY }),
      ]),
  })
}

/** Gericht ändern, Foto hochladen oder entfernen, löschen; im Alltag ohne Eltern-PIN. */
function useDishMutation<TVariables, TResult>(
  request: (variables: TVariables) => Promise<TResult>,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: request,
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: MEAL_WEEK_KEY }),
        queryClient.invalidateQueries({ queryKey: DISHES_KEY }),
      ]),
  })
}

export const useUpdateDish = () =>
  useDishMutation(({ id, name, icon }: { id: number; name: string; icon: string }) =>
    api<Dish>('PUT', `/dishes/${id}`, { name, icon }),
  )

export const useDeleteDish = () =>
  useDishMutation((id: number) => api<null>('DELETE', `/dishes/${id}`))

export const useDishImage = () =>
  useDishMutation(({ id, image }: { id: number; image: Blob | null }) =>
    image
      ? api<Dish>('PUT', `/dishes/${id}/image`, image)
      : api<Dish>('DELETE', `/dishes/${id}/image`),
  )

export const useSaveRecipe = () =>
  useDishMutation(
    ({
      id,
      ...recipe
    }: {
      id: number
      ingredients: string[]
      steps: string[]
      servings: number | null
    }) => api<Dish>('PUT', `/dishes/${id}/recipe`, recipe),
  )

/** Rezept weg; ein nie geplantes Gericht geht dabei ganz. */
export const useDeleteRecipe = () =>
  useDishMutation((id: number) => api<null>('DELETE', `/dishes/${id}/recipe`))

export const useRateDish = () =>
  useDishMutation(({ id, rating }: { id: number; rating: number | null }) =>
    api<Dish>('PUT', `/dishes/${id}/rating`, { rating }),
  )

export const useImportRecipes = () =>
  useDishMutation((recipes: RecipeData[]) => api<Dish[]>('POST', '/recipes', { recipes }))

/** Hauptmahlzeit für „Woche füllen“: das Abendessen, sonst die letzte geplante Mahlzeit. */
export const mainMeal = (meals: Meal[]): Meal =>
  meals.includes('dinner') ? 'dinner' : (meals.at(-1) ?? 'dinner')

/**
 * Leere Tage (ab heute) aus der Rezeptsammlung füllen; mit `replace` auch geplante neu belegen
 * („neu würfeln“). Gibt die neuen Einträge zurück.
 */
export const useFillMeals = () =>
  useDishMutation((body: { start: string; end: string; meal: Meal; replace?: boolean }) =>
    api<MealEntry[]>('POST', '/meals/fill', body),
  )
