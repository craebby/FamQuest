import { useQuery } from '@tanstack/react-query'

import { api, apiGet } from './client'
import { useParentMutation } from './mutations'

/**
 * Bereiche der Startseite in der Reihenfolge auf der Seite: Wetter (im Kopf), Routine der Kinder
 * (tasks) und Einkauf nebeneinander, darunter die Woche mit Terminen (events) und Essen (meals).
 */
export const TILE_IDS = ['weather', 'tasks', 'shopping', 'events', 'meals'] as const
export type TileId = (typeof TILE_IDS)[number]

export interface Tile {
  id: TileId
  visible: boolean
}

/** Woche auf der Startseite: ab heute sieben Tage oder Montag bis Sonntag. */
export const WEEK_MODES = ['rolling', 'monday'] as const
export type WeekMode = (typeof WEEK_MODES)[number]

/** Sichtbarkeit der Bereiche und Beginn der Woche auf der Startseite; gilt für die ganze Familie. */
export interface HomeLayout {
  tiles: Tile[]
  week: WeekMode
}

export const HOME_LAYOUT_KEY = ['home-layout'] as const

export function useHomeLayout() {
  return useQuery({
    queryKey: HOME_LAYOUT_KEY,
    queryFn: () => apiGet<HomeLayout>('/home/layout'),
    // Ändert jemand den Aufbau an einem anderen Gerät, zieht dieses Display nach.
    refetchInterval: 5 * 60 * 1000,
  })
}

export const useSaveHomeLayout = () =>
  useParentMutation(
    (layout: HomeLayout) => api<HomeLayout>('PUT', '/home/layout', layout),
    [HOME_LAYOUT_KEY],
  )

/** Standard wie im Backend (api/home.py): alles sichtbar. */
export const DEFAULT_TILES: Tile[] = TILE_IDS.map((id) => ({ id, visible: true }))

/** Standard wie im Backend: alles sichtbar, die Woche ab heute. */
export const DEFAULT_LAYOUT: HomeLayout = { tiles: DEFAULT_TILES, week: 'rolling' }

/** Sichtbare Bereiche als Menge; unbekannte (ältere) Einträge zählen nicht. */
export function visibleTiles(tiles: Tile[]): Set<TileId> {
  return new Set(tiles.filter((tile) => tile.visible).map((tile) => tile.id))
}
