import { useQuery } from '@tanstack/react-query'

import { api, apiGet } from './client'
import { useParentMutation } from './mutations'

export interface Photo {
  id: number
  url: string
  thumb_url: string
  width: number
  height: number
  /** Aufnahmezeit laut Kamera (Ortszeit ohne Zeitzone); null = unbekannt. */
  taken_at: string | null
  visible: boolean
  created_at: string
}

export const PHOTOS_KEY = ['photos'] as const

/** Alle Fotos, zuletzt hochgeladene zuerst. */
export function usePhotos() {
  return useQuery({ queryKey: PHOTOS_KEY, queryFn: () => apiGet<Photo[]>('/photos') })
}

export const uploadPhoto = (file: Blob) => api<Photo>('POST', '/photos', file)
export const setPhotoVisible = ({ id, visible }: { id: number; visible: boolean }) =>
  api<Photo>('PATCH', `/photos/${id}`, { visible })
export const deletePhoto = (id: number) => api<void>('DELETE', `/photos/${id}`)

export function usePhotosMutation<TVariables, TResult>(
  request: (variables: TVariables) => Promise<TResult>,
) {
  return useParentMutation(request, [PHOTOS_KEY])
}
