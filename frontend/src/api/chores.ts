import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, apiGet } from './client'
import { useParentMutation } from './mutations'

// Muss zu LEVELS im Backend passen (backend/app/chores.py).
export const CHORE_LEVELS = ['due', 'soon', 'ok'] as const
/** Ampel: fällig (rot), bald dran (gelb), alles gut (grün). */
export type ChoreLevel = (typeof CHORE_LEVELS)[number]

export interface ChoreRoom {
  id: number
  name: string
  icon: string
}

export interface Chore {
  id: number
  room_id: number
  title: string
  icon: string
  /** So viele Tage nach der letzten Erledigung ist sie wieder fällig. */
  interval_days: number
  active: boolean
  /** Letzte Erledigung (ISO-Datum); null = seit dem Anlegen noch nie. */
  last_done: string | null
  done_today: boolean
  /** Wer die letzte Erledigung übernommen hat, falls angegeben. */
  done_by: number | null
  /** Ab diesem Tag läuft die Uhr: letzte Erledigung oder von den Eltern festgelegt (ISO-Datum). */
  counted_from: string
  due_date: string
  /** Tage bis zur Fälligkeit; 0 = heute, negativ = so viele Tage drüber. */
  days_left: number
  /** Verstrichener Anteil des Abstands; über 1 heißt überfällig. */
  ratio: number
  level: ChoreLevel
}

export interface ChorePlan {
  /** Heute in der Zeitzone der Familie. */
  date: string
  rooms: ChoreRoom[]
  chores: Chore[]
  /** So viele Tage zählt die faire Verteilung zurück (heute eingeschlossen). */
  share_days: number
  /** Wer in dieser Zeit wie oft etwas erledigt hat; nur mit Angabe „Wer war's?“. */
  shares: { member_id: number; count: number }[]
}

export interface RoomData {
  name: string
  icon: string
}

export interface ChoreData {
  room_id: number
  title: string
  icon: string
  interval_days: number
  active: boolean
  /** „Zuletzt erledigt“ von Hand (ISO-Datum); ohne Angabe bleibt der Stand, wie er ist. */
  counted_from?: string
}

// Muss zu StartState im Backend passen (backend/app/api/chores.py).
export const START_STATES = ['fresh', 'half', 'due'] as const
/** Stand beim Anlegen: gerade erledigt, mittendrin oder jetzt fällig. */
export type StartState = (typeof START_STATES)[number]

/** Längster Abstand in Tagen (drei Jahre), wie im Backend. */
export const CHORE_MAX_INTERVAL = 1095

export interface SetupRoom extends RoomData {
  chores: { title: string; icon: string; interval_days: number }[]
}

export const CHORES_KEY = ['chores'] as const

/** Erledigt jemand etwas am Handy, zieht das Display nach; die Ampel rückt ohnehin täglich vor. */
export const CHORES_REFETCH_MS = 60 * 1000

export function useChores() {
  return useQuery({
    queryKey: CHORES_KEY,
    queryFn: () => apiGet<ChorePlan>('/chores'),
    refetchInterval: CHORES_REFETCH_MS,
  })
}

/** Erledigen und zurücknehmen am Display, ohne Eltern-PIN; die Antwort ersetzt die Aufgabe sofort. */
function useDoneMutation<TVariables>(request: (variables: TVariables) => Promise<Chore>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: request,
    onSuccess: (chore) => {
      queryClient.setQueryData<ChorePlan>(
        CHORES_KEY,
        (plan) =>
          plan && {
            ...plan,
            chores: plan.chores.map((item) => (item.id === chore.id ? chore : item)),
          },
      )
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: CHORES_KEY }),
  })
}

/** Heute erledigt; ein zweiter Aufruf trägt nach, wer es war (`memberId` null = keine Angabe). */
export const useMarkDone = () =>
  useDoneMutation(({ id, memberId }: { id: number; memberId: number | null }) =>
    api<Chore>('PUT', `/chores/${id}/done`, { member_id: memberId }),
  )

export const useUndoDone = () =>
  useDoneMutation((id: number) => api<Chore>('DELETE', `/chores/${id}/done`))

export const createRoom = (data: RoomData) => api<ChoreRoom>('POST', '/chores/rooms', data)
export const updateRoom = (id: number, data: RoomData) =>
  api<ChoreRoom>('PUT', `/chores/rooms/${id}`, data)
export const deleteRoom = (id: number) => api<void>('DELETE', `/chores/rooms/${id}`)

export const createChore = (data: ChoreData & { state?: StartState }) =>
  api<Chore>('POST', '/chores', data)
export const updateChore = (id: number, data: ChoreData) => api<Chore>('PUT', `/chores/${id}`, data)
export const deleteChore = (id: number) => api<void>('DELETE', `/chores/${id}`)

export const choreData = (chore: Chore): ChoreData => ({
  room_id: chore.room_id,
  title: chore.title,
  icon: chore.icon,
  interval_days: chore.interval_days,
  active: chore.active,
})

/** Übernimmt die Vorschläge des Einrichtungs-Assistenten; Vorhandenes wird übersprungen. */
export const setupChores = (rooms: SetupRoom[]) =>
  api<{ rooms: number; chores: number }>('POST', '/chores/setup', { rooms })

/** Änderung am Putzplan im Elternbereich. */
export function useChoresMutation<TVariables, TResult>(
  request: (variables: TVariables) => Promise<TResult>,
) {
  return useParentMutation(request, [CHORES_KEY])
}
