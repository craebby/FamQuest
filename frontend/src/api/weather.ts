import { useQuery, useQueryClient } from '@tanstack/react-query'

import { api, apiGet } from './client'
import { useParentMutation } from './mutations'

export interface Place {
  name: string
  latitude: number
  longitude: number
}

/** Treffer der Ortssuche; Region und Land unterscheiden gleichnamige Orte. */
export interface PlaceResult extends Place {
  region: string | null
  country: string | null
}

export interface WeatherDay {
  /** `YYYY-MM-DD` */
  date: string
  /** WMO-Wettercode */
  code: number
  max: number
  min: number
  /** Höchste Regenwahrscheinlichkeit in Prozent; null = unbekannt. */
  precipitation: number | null
}

export interface Weather {
  /** null: Die Eltern haben noch keinen Ort festgelegt. */
  place: Place | null
  current: { temperature: number; code: number; is_day: boolean } | null
  /** Heute und die nächsten Tage. */
  days: WeatherDay[]
  /** Open-Meteo war zuletzt nicht erreichbar; das ist eine ältere Vorhersage. */
  stale: boolean
}

export const WEATHER_KEY = ['weather'] as const
/** Der Server fragt höchstens alle 15 Minuten bei Open-Meteo nach. */
const WEATHER_REFETCH_MS = 10 * 60 * 1000

export function useWeather() {
  return useQuery({
    queryKey: WEATHER_KEY,
    queryFn: () => apiGet<Weather>('/weather'),
    refetchInterval: WEATHER_REFETCH_MS,
  })
}

/** Ortssuche im Elternbereich; sucht erst ab zwei Zeichen. */
export function usePlaceSearch(query: string, language: string) {
  const q = query.trim()
  return useQuery({
    queryKey: ['weather-places', q, language],
    queryFn: () =>
      apiGet<PlaceResult[]>(
        `/weather/places?q=${encodeURIComponent(q)}&lang=${language.slice(0, 2)}`,
      ),
    enabled: q.length >= 2,
    staleTime: Infinity,
  })
}

function usePlaceMutation<TVariables>(request: (variables: TVariables) => Promise<unknown>) {
  const queryClient = useQueryClient()
  const mutation = useParentMutation(request, [WEATHER_KEY])
  return {
    ...mutation,
    mutate: (variables: TVariables, options?: { onSuccess?: () => void }) =>
      mutation.mutate(variables, {
        onSuccess: () => {
          queryClient.removeQueries({ queryKey: ['weather-places'] })
          options?.onSuccess?.()
        },
      }),
  }
}

export const useSetWeatherPlace = () =>
  usePlaceMutation((place: Place) => api<{ place: Place }>('PUT', '/weather/place', place))

export const useRemoveWeatherPlace = () =>
  usePlaceMutation(() => api<{ place: null }>('DELETE', '/weather/place'))
