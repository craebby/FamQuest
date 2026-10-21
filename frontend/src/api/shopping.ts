import {
  type Mutation,
  type QueryClient,
  type UseMutationOptions,
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useMemo } from 'react'

import type { Area } from '../pages/shopping/areas'

import { ApiError, api, apiGet } from './client'
import {
  type ShoppingOp,
  type ShoppingOpKind,
  type ShoppingOpVariables,
  applyOp,
  applyOps,
  confirmItem,
  sameName,
} from './shoppingOps'

export interface ListItem {
  id: number
  name: string
  icon: string
  /** Menge oder Hinweis, z. B. „2 ×“ oder „laktosefrei“. */
  note: string | null
  checked: boolean
  /** Laden bzw. Bereich, wenn von Hand verschoben; null = automatisch (siehe areas.ts). */
  area: Area | null
  /** Platz im Bereich, wenn von Hand sortiert; null = nach der Zeit des Eintragens. */
  position: number | null
}

export interface ShoppingList {
  /** Offene in der Reihenfolge des Eintragens, danach die heute abgehakten. */
  items: ListItem[]
}

/** Bekannter Artikel der Familie, für die Vorschläge. */
export interface ShoppingItem {
  id: number
  name: string
  icon: string
  times_added: number
  /** Steht gerade offen auf der Liste. */
  on_list: boolean
}

export const SHOPPING_LIST_KEY = ['shopping-list'] as const
export const SHOPPING_ITEMS_KEY = ['shopping-items'] as const

/** Trägt jemand am Handy etwas ein oder hakt ab, zieht das Display schnell nach. */
export const SHOPPING_REFETCH_MS = 30 * 1000

/** Alle Änderungen an der Liste; sie laufen nacheinander in der Reihenfolge des Antippens. */
export const SHOPPING_OP_KEY = ['shopping-op'] as const

/** Ausstehende Änderungen (ohne Netz wartend oder gerade unterwegs), älteste zuerst. */
function usePendingOps(): ShoppingOp[] {
  return useMutationState({
    filters: { mutationKey: SHOPPING_OP_KEY, status: 'pending' },
    select: (mutation) => toOp(mutation),
  })
}

function toOp(mutation: Mutation<unknown, Error, unknown, unknown>): ShoppingOp {
  return {
    kind: mutation.options.mutationKey?.[1] as ShoppingOpKind,
    variables: mutation.state.variables,
    tempId: -mutation.mutationId,
  } as ShoppingOp
}

/** Wie viele Änderungen noch nicht beim Server angekommen sind. */
export const usePendingShoppingCount = () => usePendingOps().length

/**
 * Die Liste, wie sie nach allen ausstehenden Änderungen aussehen wird: Im Laden ohne Netz ist
 * jeder Tipp sofort zu sehen, auch nach einem Neustart der App.
 */
export function useShoppingList() {
  const query = useQuery({
    queryKey: SHOPPING_LIST_KEY,
    queryFn: () => apiGet<ShoppingList>('/shopping/list'),
    refetchInterval: SHOPPING_REFETCH_MS,
  })
  const pending = usePendingOps()
  const data = useMemo(
    () => (query.data ? applyOps(query.data, pending) : undefined),
    [query.data, pending],
  )
  return { ...query, data }
}

export function useShoppingItems() {
  return useQuery({
    queryKey: SHOPPING_ITEMS_KEY,
    queryFn: () => apiGet<ShoppingItem[]>('/shopping/items'),
  })
}

/** Netzfehler und Ausfälle des Servers (z. B. 502 beim Neustart) gehen später noch einmal raus. */
const isTemporary = (error: unknown) =>
  error instanceof ApiError && (error.status === 0 || error.status >= 500)

/** Ist der Artikel schon weg (anderswo entfernt), ist die Änderung erledigt. */
async function unlessGone<T>(request: Promise<T>): Promise<T | null> {
  try {
    return await request
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

/** Die echte ID; ein offline eingetragener Artikel hat bis zum Senden nur eine vorläufige. */
async function resolveId(queryClient: QueryClient, id: number, name: string) {
  if (id > 0) return id
  const find = (list?: ShoppingList) =>
    list?.items.find((item) => item.id > 0 && sameName(item.name, name))?.id
  return (
    find(queryClient.getQueryData<ShoppingList>(SHOPPING_LIST_KEY)) ??
    find(await apiGet<ShoppingList>('/shopping/list'))
  )
}

async function send(queryClient: QueryClient, op: ShoppingOp): Promise<ListItem | null> {
  switch (op.kind) {
    case 'add':
      return api<ListItem>('POST', '/shopping/list', op.variables)
    case 'check': {
      const { name, checked } = op.variables
      const id = await resolveId(queryClient, op.variables.id, name)
      if (id === undefined) return null
      return unlessGone(api<ListItem>('PUT', `/shopping/list/${id}/checked`, { checked }))
    }
    case 'remove': {
      const id = await resolveId(queryClient, op.variables.id, op.variables.name)
      if (id === undefined) return null
      return unlessGone(api<null>('DELETE', `/shopping/list/${id}`))
    }
    case 'clear':
      return api<null>('DELETE', '/shopping/list/checked')
    case 'move': {
      const id = await resolveId(queryClient, op.variables.id, op.variables.name)
      if (id === undefined) return null
      const { area } = op.variables
      return unlessGone(api<null>('PUT', `/shopping/items/${id}/area`, { area }))
    }
    case 'order': {
      const ids = await Promise.all(
        op.variables.items.map(({ id, name }) => resolveId(queryClient, id, name)),
      )
      const known = ids.filter((id) => id !== undefined)
      return api<null>('PUT', '/shopping/order', { ids: known })
    }
  }
}

/**
 * Optionen einer Änderung. Gelten auch als Vorgabe im QueryClient (siehe offline.ts), damit
 * gespeicherte Änderungen nach einem Neustart der App ohne Netz noch gesendet werden.
 */
export function shoppingOpOptions<K extends ShoppingOpKind>(
  queryClient: QueryClient,
  kind: K,
): UseMutationOptions<ListItem | null, Error, ShoppingOpVariables[K]> {
  return {
    mutationKey: [...SHOPPING_OP_KEY, kind],
    // Eine Warteschlange für alle: Was offline eingetragen und dann abgehakt wird, kommt in
    // dieser Reihenfolge beim Server an.
    scope: { id: 'shopping' },
    mutationFn: (variables) => send(queryClient, { kind, variables, tempId: 0 } as ShoppingOp),
    retry: (_count, error) => isTemporary(error),
    onSuccess: (result, variables) => {
      // Gleich übernehmen, damit die Liste zwischen Senden und Neuladen nicht zurückspringt.
      queryClient.setQueryData<ShoppingList>(SHOPPING_LIST_KEY, (list) => {
        if (!list) return list
        if (result) return confirmItem(list, result)
        return applyOp(list, { kind, variables, tempId: 0 } as ShoppingOp)
      })
    },
    onSettled: () => {
      // Erst nach der letzten wartenden Änderung neu laden, sonst flackert die Liste.
      if (queryClient.isMutating({ mutationKey: SHOPPING_OP_KEY }) > 1) return
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: SHOPPING_LIST_KEY }),
        queryClient.invalidateQueries({ queryKey: SHOPPING_ITEMS_KEY }),
      ])
    },
  }
}

/** Gibt die Optionen für gespeicherte Änderungen als Vorgabe an den QueryClient. */
export function registerShoppingOps(queryClient: QueryClient) {
  for (const kind of ['add', 'check', 'remove', 'clear', 'move', 'order'] as const)
    queryClient.setMutationDefaults(
      [...SHOPPING_OP_KEY, kind],
      shoppingOpOptions(queryClient, kind),
    )
}

function useShoppingOp<K extends ShoppingOpKind>(kind: K) {
  const queryClient = useQueryClient()
  return useMutation(shoppingOpOptions(queryClient, kind))
}

/** Auf die Liste setzen; `note` undefined lässt die Notiz eines offenen Artikels stehen. */
export const useAddToList = () => useShoppingOp('add')

/** Abhaken oder zurücknehmen; die Liste zeigt es sofort, im Laden zählt jede Sekunde. */
export const useCheckItem = () => useShoppingOp('check')

export const useRemoveFromList = () => useShoppingOp('remove')

export const useClearChecked = () => useShoppingOp('clear')

/** In einen anderen Laden oder Bereich verschieben; geht wie das Abhaken auch ohne Netz. */
export const useMoveItem = () => useShoppingOp('move')

/** Reihenfolge innerhalb eines Bereichs, z. B. nach dem Laufweg im Laden. */
export const useOrderItems = () => useShoppingOp('order')

/** Bekannte Artikel ändern braucht Netz; ohne kommt sofort der Fehler statt ewigem Warten. */
function useItemMutation<TVariables, TResult>(
  request: (variables: TVariables) => Promise<TResult>,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: request,
    networkMode: 'always',
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: SHOPPING_LIST_KEY }),
        queryClient.invalidateQueries({ queryKey: SHOPPING_ITEMS_KEY }),
      ]),
  })
}

export const useUpdateItem = () =>
  useItemMutation(({ id, name, icon }: { id: number; name: string; icon: string }) =>
    api<ShoppingItem>('PUT', `/shopping/items/${id}`, { name, icon }),
  )

export const useDeleteItem = () =>
  useItemMutation((id: number) => api<null>('DELETE', `/shopping/items/${id}`))
