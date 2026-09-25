import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { FamilyColor } from '../memberColors'
import { api, apiGet } from './client'
import { useParentMutation } from './mutations'

export interface Calendar {
  id: number
  name: string
  primary: boolean
  /** Ausgewählte Kalender werden synchronisiert und am Display angezeigt. */
  selected: boolean
  /** `null`: gehört der ganzen Familie. */
  member_id: number | null
  synced_at: string | null
  /** Fehlercode der letzten Synchronisation (übersetzt unter `errors.*`). */
  sync_error: string | null
}

export interface CalendarConnection {
  id: number
  provider: 'google'
  account_email: string
  /** `reconnect`: Zugriff widerrufen oder abgelaufen, neu verbinden nötig. */
  status: 'ok' | 'reconnect'
  created_at: string
  calendars: Calendar[]
}

// Muss zu REGIONS im Backend passen (backend/app/holidays.py).
export const HOLIDAY_REGIONS = [
  'BW',
  'BY',
  'BE',
  'BB',
  'HB',
  'HH',
  'HE',
  'MV',
  'NI',
  'NW',
  'RP',
  'SL',
  'SN',
  'ST',
  'SH',
  'TH',
] as const
export type HolidayRegion = (typeof HOLIDAY_REGIONS)[number]

export interface HolidaySettings {
  /** Bundesland; `null` = keins gewählt. */
  region: HolidayRegion | null
  /** Gesetzliche Feiertage anzeigen. */
  public: boolean
  /** Schulferien anzeigen. */
  school: boolean
}

export interface CalendarSettings {
  /** False, solange die Google-Zugangsdaten in der Konfiguration fehlen. */
  configured: boolean
  /** In der Google Cloud Console als Weiterleitungs-URI einzutragen. */
  redirect_uri: string
  family_color: FamilyColor
  holidays: HolidaySettings
  connections: CalendarConnection[]
}

export interface WeekEvent {
  key: string
  /** `null`: Termin ohne Titel (z. B. nur „beschäftigt“ freigegeben). */
  title: string | null
  location: string | null
  /** Reiner Text, ggf. mit Zeilenumbrüchen. */
  description: string | null
  /** Namen der Kalender, aus denen der Termin stammt. */
  calendars: string[]
  all_day: boolean
  /** Ganztägig: `YYYY-MM-DD` (Ende exklusiv); sonst ISO-Zeitpunkt. */
  start: string
  end: string
  member_ids: number[]
  /** Gehört (auch) der ganzen Familie. */
  family: boolean
  continues_before: boolean
  continues_after: boolean
}

export interface CalendarWeek {
  start: string
  today: string
  timezone: string
  family_color: FamilyColor
  /** Mindestens ein angezeigter Kalender wird gerade nicht aktualisiert. */
  problem: boolean
  days: {
    date: string
    /** Feiertage und Schulferien, falls im Elternbereich eingeschaltet. */
    holidays: { kind: 'public' | 'school'; name: string }[]
    events: WeekEvent[]
  }[]
}

/** Termin auf der Startseite, mit dem Tag, unter dem er steht (bei laufenden: heute). */
export interface UpcomingEvent extends WeekEvent {
  day: string
}

export interface CalendarUpcoming {
  today: string
  timezone: string
  family_color: FamilyColor
  problem: boolean
  /** Feiertage und Schulferien heute. */
  holidays: { kind: 'public' | 'school'; name: string }[]
  events: UpcomingEvent[]
}

export const CALENDAR_SETTINGS_KEY = ['calendar-settings'] as const
export const CALENDAR_STATUS_KEY = ['calendar-status'] as const
export const CALENDAR_WEEK_KEY = ['calendar-week'] as const
export const CALENDAR_UPCOMING_KEY = ['calendar-upcoming'] as const

/** Solange ein ausgewählter Kalender noch nie geladen wurde, öfter nachsehen. */
const LOADING_POLL_MS = 3000

export function useCalendarSettings() {
  return useQuery({
    queryKey: CALENDAR_SETTINGS_KEY,
    queryFn: () => apiGet<CalendarSettings>('/calendar/settings'),
    refetchInterval: (query) =>
      query.state.data?.connections.some(
        (connection) =>
          connection.status === 'ok' &&
          connection.calendars.some((calendar) => calendar.selected && !calendar.synced_at),
      )
        ? LOADING_POLL_MS
        : false,
  })
}

/** Ob das Display einen Kalender anzeigt (mindestens ein Kalender ausgewählt). */
export function useCalendarStatus() {
  return useQuery({
    queryKey: CALENDAR_STATUS_KEY,
    queryFn: () => apiGet<{ enabled: boolean }>('/calendar/status'),
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Termine der Woche; `offset` 0 = aktuelle Woche. `language` bestimmt die Namen der Feiertage.
 * Aktualisiert sich jede Minute.
 */
export function useCalendarWeek(offset: number, language: string) {
  return useQuery({
    queryKey: [...CALENDAR_WEEK_KEY, offset, language],
    queryFn: () =>
      apiGet<CalendarWeek>(`/calendar/week?offset=${offset}&lang=${language.slice(0, 2)}`),
    refetchInterval: 60 * 1000,
    placeholderData: keepPreviousData,
  })
}

/** Die nächsten Termine für die Startseite; vergangene fallen jede Minute heraus. */
export function useCalendarUpcoming(limit: number, language: string) {
  return useQuery({
    queryKey: [...CALENDAR_UPCOMING_KEY, limit, language],
    queryFn: () =>
      apiGet<CalendarUpcoming>(`/calendar/upcoming?limit=${limit}&lang=${language.slice(0, 2)}`),
    refetchInterval: 60 * 1000,
  })
}

/** Startet die Anmeldung bei Google; der Browser verlässt dafür die App. */
export function useConnectGoogle() {
  return useMutation({
    mutationFn: () => api<{ url: string }>('POST', '/calendar/google/connect'),
    onSuccess: ({ url }) => window.location.assign(url),
  })
}

const CALENDAR_KEYS = [
  CALENDAR_SETTINGS_KEY,
  CALENDAR_STATUS_KEY,
  CALENDAR_WEEK_KEY,
  CALENDAR_UPCOMING_KEY,
]

export const useDisconnectCalendar = () =>
  useParentMutation(
    (id: number) => api<void>('DELETE', `/calendar/connections/${id}`),
    CALENDAR_KEYS,
  )

/** Antwort ist der neue Stand der Einstellungen; er wird direkt übernommen. */
function useSettingsMutation<TVariables>(
  request: (variables: TVariables) => Promise<CalendarSettings>,
) {
  const queryClient = useQueryClient()
  const mutation = useParentMutation(request, [
    CALENDAR_STATUS_KEY,
    CALENDAR_WEEK_KEY,
    CALENDAR_UPCOMING_KEY,
  ])
  return {
    ...mutation,
    mutate: (variables: TVariables, options?: { onSuccess?: () => void }) =>
      mutation.mutate(variables, {
        onSuccess: (settings) => {
          queryClient.setQueryData(CALENDAR_SETTINGS_KEY, settings)
          options?.onSuccess?.()
        },
      }),
  }
}

export const useUpdateCalendar = () =>
  useSettingsMutation(
    ({ id, selected, memberId }: { id: number; selected: boolean; memberId: number | null }) =>
      api<CalendarSettings>('PUT', `/calendar/calendars/${id}`, {
        selected,
        member_id: memberId,
      }),
  )

export const useSetFamilyColor = () =>
  useSettingsMutation((color: FamilyColor) =>
    api<CalendarSettings>('PUT', '/calendar/family-color', { color }),
  )

export const useSetHolidays = () =>
  useSettingsMutation((holidays: HolidaySettings) =>
    api<CalendarSettings>('PUT', '/calendar/holidays', holidays),
  )

export const useSyncCalendars = () =>
  useSettingsMutation(() => api<CalendarSettings>('POST', '/calendar/sync'))
