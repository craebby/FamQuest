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

/** Einmaliges aus „Zu erledigen“, ohne Person und Termin. */
export interface Todo {
  id: number
  title: string
  icon: string
  /** Heute abgehakt; bleibt bis zum Ende des Tages auf der Liste. */
  done: boolean
  /** Wer es erledigt hat, falls angegeben. */
  done_by: number | null
}

export interface ChorePlan {
  /** Heute in der Zeitzone der Familie. */
  date: string
  rooms: ChoreRoom[]
  chores: Chore[]
  /** „Zu erledigen“: Offenes in der Reihenfolge des Eintragens, danach das heute Abgehakte. */
  todos: Todo[]
  /** So viele Tage zählt die faire Verteilung zurück (heute eingeschlossen). */
  share_days: number
  /** Wer in dieser Zeit wie oft etwas erledigt hat (Putzplan und Liste); nur mit „Wer war's?“. */
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

/**
 * Erledigen und zurücknehmen am Display, ohne Eltern-PIN; die Antwort ersetzt den Eintrag in
 * `list` (Aufgaben des Putzplans oder „Zu erledigen“) sofort.
 */
function useDoneMutation<TVariables, TItem extends { id: number }>(
  list: 'chores' | 'todos',
  request: (variables: TVariables) => Promise<TItem>,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: request,
    onSuccess: (result) => {
      queryClient.setQueryData<ChorePlan>(
        CHORES_KEY,
        (plan) =>
          plan && {
            ...plan,
            [list]: plan[list].map((item) => (item.id === result.id ? result : item)),
          },
      )
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: CHORES_KEY }),
  })
}

/** Heute erledigt; ein zweiter Aufruf trägt nach, wer es war (`memberId` null = keine Angabe). */
export const useMarkDone = () =>
  useDoneMutation('chores', ({ id, memberId }: { id: number; memberId: number | null }) =>
    api<Chore>('PUT', `/chores/${id}/done`, { member_id: memberId }),
  )

export const useUndoDone = () =>
  useDoneMutation('chores', (id: number) => api<Chore>('DELETE', `/chores/${id}/done`))

/** Wie im Putzplan: abhaken, ein zweiter Aufruf trägt nach, wer es war. */
export const useTodoDone = () =>
  useDoneMutation('todos', ({ id, memberId }: { id: number; memberId: number | null }) =>
    api<Todo>('PUT', `/todos/${id}/done`, { member_id: memberId }),
  )

export const useTodoUndo = () =>
  useDoneMutation('todos', (id: number) => api<Todo>('DELETE', `/todos/${id}/done`))

/** Eintragen und streichen in „Zu erledigen“, ohne Eltern-PIN; danach den Haushalt neu laden. */
function useTodoMutation<TVariables, TResult>(
  request: (variables: TVariables) => Promise<TResult>,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: request,
    onSettled: () => queryClient.invalidateQueries({ queryKey: CHORES_KEY }),
  })
}

export const useAddTodo = () =>
  useTodoMutation((todo: { title: string; icon: string }) => api<Todo>('POST', '/todos', todo))

export const useRemoveTodo = () =>
  useTodoMutation((id: number) => api<null>('DELETE', `/todos/${id}`))

export const createRoom = (data: RoomData) => api<ChoreRoom>('POST', '/chores/rooms', data)
export const updateRoom = (id: number, data: RoomData) =>
  api<ChoreRoom>('PUT', `/chores/rooms/${id}`, data)
export const deleteRoom = (id: number) => api<void>('DELETE', `/chores/rooms/${id}`)

/** `todo_id`: „kommt wieder“, der Eintrag aus „Zu erledigen“ wird zu dieser Aufgabe. */
export const createChore = (data: ChoreData & { state?: StartState; todo_id?: number }) =>
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
