import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, apiGet } from './client'
import { DISHES_KEY, MEAL_WEEK_KEY } from './meals'
import { useParentMutation } from './mutations'

/**
 * Mealie: `off` aus, `link` nur ein Knopf zu Mealie in der Leiste, `mixed` eigene und
 * Mealie-Rezepte, `only` nur Mealie-Rezepte in Rezeptsammlung und „Woche füllen“.
 */
export const MEALIE_MODES = ['off', 'link', 'mixed', 'only'] as const
export type MealieMode = (typeof MEALIE_MODES)[number]

export interface MealieSettings {
  mode: MealieMode
  url: string | null
  /** Ein API-Token ist gespeichert (er selbst kommt nie zurück). */
  has_token: boolean
  /** Lässt sich ein Token speichern (TOKEN_ENCRYPTION_KEY auf dem Server)? */
  can_store_token: boolean
  synced_at: string | null
  /** Fehlercode des letzten Abgleichs, z. B. `mealie.unreachable`. */
  sync_error: string | null
  recipes: number
}

export interface MealieRecipe {
  id: string
  name: string
  url: string | null
  image_url: string | null
  rating: number | null
}

export const MEALIE_KEY = ['mealie'] as const
export const MEALIE_RECIPES_KEY = ['mealie-recipes'] as const

export function useMealie() {
  return useQuery({ queryKey: MEALIE_KEY, queryFn: () => apiGet<MealieSettings>('/mealie') })
}

/** Kommen gerade Rezepte aus Mealie? */
export const mealieRecipesOn = (settings: MealieSettings | undefined) =>
  settings?.mode === 'mixed' || settings?.mode === 'only'

/** Adresse für den Knopf in der Leiste; ohne Mealie null. */
export const mealieUrl = (settings: MealieSettings | undefined) =>
  settings && settings.mode !== 'off' ? settings.url : null

export function useMealieRecipes(enabled = true) {
  return useQuery({
    enabled,
    queryKey: MEALIE_RECIPES_KEY,
    queryFn: () => apiGet<MealieRecipe[]>('/mealie/recipes'),
  })
}

const AFTER_SYNC = [MEALIE_KEY, MEALIE_RECIPES_KEY, DISHES_KEY, MEAL_WEEK_KEY]

/** Modus, Adresse und Token speichern (`token` undefined lässt ihn, "" löscht ihn). */
export const useSaveMealie = () =>
  useParentMutation(
    (body: { mode: MealieMode; url?: string; token?: string }) =>
      api<MealieSettings>('PUT', '/mealie', body),
    AFTER_SYNC,
  )

export const useSyncMealie = () =>
  useParentMutation(() => api<MealieSettings>('POST', '/mealie/sync'), AFTER_SYNC)

/** Gericht mit einem Mealie-Rezept verknüpfen oder lösen (`recipeId` null); ohne Eltern-PIN. */
export function useLinkMealie() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ dishId, recipeId }: { dishId: number; recipeId: string | null }) =>
      api('PUT', `/dishes/${dishId}/mealie`, { recipe_id: recipeId }),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: DISHES_KEY }),
        queryClient.invalidateQueries({ queryKey: MEAL_WEEK_KEY }),
      ]),
  })
}

/** Ein Rezept gleich frisch aus Mealie holen (beim Öffnen zum Kochen); Fehler bleiben still. */
export function useRefreshMealieRecipe() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (recipeId: string) => api<null>('POST', `/mealie/recipes/${recipeId}/refresh`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DISHES_KEY }),
  })
}
