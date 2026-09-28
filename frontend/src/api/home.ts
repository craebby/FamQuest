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

/** Sichtbarkeit der Bereiche der Startseite; gilt für die ganze Familie. */
export interface HomeLayout {
  tiles: Tile[]
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

/** Sichtbare Bereiche als Menge; unbekannte (ältere) Einträge zählen nicht. */
export function visibleTiles(tiles: Tile[]): Set<TileId> {
  return new Set(tiles.filter((tile) => tile.visible).map((tile) => tile.id))
}
