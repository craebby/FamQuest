import { useQuery } from '@tanstack/react-query'

import { api, apiGet } from './client'
import { useParentMutation } from './mutations'

/** Wie lange ein Foto stehen bleibt; dieselbe Auswahl wie im Backend (api/frame.py). */
export const PHOTO_SECONDS = [15, 30, 60, 120, 300] as const
export type PhotoSeconds = (typeof PHOTO_SECONDS)[number]

/** Einblendungen und Anzeigedauer des Bilderrahmens; gilt für die ganze Familie. */
export interface FrameSettings {
  show_clock: boolean
  show_weather: boolean
  show_event: boolean
  show_tasks: boolean
  photo_seconds: PhotoSeconds
}

/** Standard wie im Backend: ruhig, mit Uhr, Wetter und nächstem Termin, ohne Aufgaben. */
export const DEFAULT_FRAME_SETTINGS: FrameSettings = {
  show_clock: true,
  show_weather: true,
  show_event: true,
  show_tasks: false,
  photo_seconds: 60,
}

export const FRAME_SETTINGS_KEY = ['frame-settings'] as const

export function useFrameSettings() {
  return useQuery({
    queryKey: FRAME_SETTINGS_KEY,
    queryFn: () => apiGet<FrameSettings>('/frame/settings'),
    // Ändern die Eltern etwas am Handy, zieht das Display nach.
    refetchInterval: 5 * 60 * 1000,
  })
}

export const useSaveFrameSettings = () =>
  useParentMutation(
    (settings: FrameSettings) => api<FrameSettings>('PUT', '/frame/settings', settings),
    [FRAME_SETTINGS_KEY],
  )
