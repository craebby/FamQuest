import { useMutation, useQuery } from '@tanstack/react-query'

import { api, apiGet } from './client'
import { useParentMutation } from './mutations'

export interface CalendarConnection {
  id: number
  provider: 'google'
  account_email: string
  /** `reconnect`: Zugriff widerrufen oder abgelaufen, neu verbinden nötig. */
  status: 'ok' | 'reconnect'
  created_at: string
}

export interface CalendarSettings {
  /** False, solange die Google-Zugangsdaten in der Konfiguration fehlen. */
  configured: boolean
  /** In der Google Cloud Console als Weiterleitungs-URI einzutragen. */
  redirect_uri: string
  connections: CalendarConnection[]
}

export const CALENDAR_SETTINGS_KEY = ['calendar-settings'] as const

export function useCalendarSettings() {
  return useQuery({
    queryKey: CALENDAR_SETTINGS_KEY,
    queryFn: () => apiGet<CalendarSettings>('/calendar/settings'),
  })
}

/** Startet die Anmeldung bei Google; der Browser verlässt dafür die App. */
export function useConnectGoogle() {
  return useMutation({
    mutationFn: () => api<{ url: string }>('POST', '/calendar/google/connect'),
    onSuccess: ({ url }) => window.location.assign(url),
  })
}

export const useDisconnectCalendar = () =>
  useParentMutation(
    (id: number) => api<void>('DELETE', `/calendar/connections/${id}`),
    [CALENDAR_SETTINGS_KEY],
  )
