import { useQuery } from '@tanstack/react-query'

import { api, apiGet } from './client'
import { useParentMutation } from './mutations'

export const TILE_IDS = ['weather', 'events', 'tasks', 'week', 'meals', 'shopping'] as const
export type TileId = (typeof TILE_IDS)[number]

export interface Tile {
  id: TileId
  visible: boolean
}

/** Kacheln der Startseite in Reihenfolge; gilt für die ganze Familie. */
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

/** Standardaufbau wie im Backend (api/home.py); die Woche ist zuschaltbar. */
export const DEFAULT_TILES: Tile[] = [
  { id: 'weather', visible: true },
  { id: 'events', visible: true },
  { id: 'tasks', visible: true },
  { id: 'meals', visible: true },
  { id: 'shopping', visible: true },
  { id: 'week', visible: false },
]

/**
 * Spalten auf dem großen Display: Die Aufgaben stehen breit in der Mitte, Kacheln davor links,
 * danach rechts. Ohne Aufgaben verteilen sich die Kacheln der Reihe nach auf bis zu drei Spalten.
 */
export function layoutColumns(tiles: TileId[]): { tiles: TileId[]; wide: boolean }[] {
  const tasks = tiles.indexOf('tasks')
  if (tasks >= 0) {
    return [
      { tiles: tiles.slice(0, tasks), wide: false },
      { tiles: ['tasks' as const], wide: true },
      { tiles: tiles.slice(tasks + 1), wide: false },
    ].filter((column) => column.tiles.length > 0)
  }
  const count = Math.min(3, tiles.length)
  const columns: { tiles: TileId[]; wide: boolean }[] = []
  let start = 0
  for (let index = 0; index < count; index++) {
    const size = Math.ceil((tiles.length - start) / (count - index))
    columns.push({ tiles: tiles.slice(start, start + size), wide: false })
    start += size
  }
  return columns
}
