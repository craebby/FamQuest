import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, apiGet } from './client'

export interface ListItem {
  id: number
  name: string
  icon: string
  /** Menge oder Hinweis, z. B. „2 ×“ oder „laktosefrei“. */
  note: string | null
  checked: boolean
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

export function useShoppingList() {
  return useQuery({
    queryKey: SHOPPING_LIST_KEY,
    queryFn: () => apiGet<ShoppingList>('/shopping/list'),
    refetchInterval: SHOPPING_REFETCH_MS,
  })
}

export function useShoppingItems() {
  return useQuery({
    queryKey: SHOPPING_ITEMS_KEY,
    queryFn: () => apiGet<ShoppingItem[]>('/shopping/items'),
  })
}

/** Änderungen im Alltag, ohne Eltern-PIN; danach Liste und Vorschläge neu laden. */
function useShoppingMutation<TVariables, TResult>(
  request: (variables: TVariables) => Promise<TResult>,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: request,
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: SHOPPING_LIST_KEY }),
        queryClient.invalidateQueries({ queryKey: SHOPPING_ITEMS_KEY }),
      ]),
  })
}

/** Auf die Liste setzen; `note` undefined lässt die Notiz eines offenen Artikels stehen. */
export const useAddToList = () =>
  useShoppingMutation((item: { name: string; icon: string; note?: string }) =>
    api<ListItem>('POST', '/shopping/list', item),
  )

export const useRemoveFromList = () =>
  useShoppingMutation((id: number) => api<null>('DELETE', `/shopping/list/${id}`))

export const useClearChecked = () =>
  useShoppingMutation(() => api<null>('DELETE', '/shopping/list/checked'))

export const useUpdateItem = () =>
  useShoppingMutation(({ id, name, icon }: { id: number; name: string; icon: string }) =>
    api<ShoppingItem>('PUT', `/shopping/items/${id}`, { name, icon }),
  )

export const useDeleteItem = () =>
  useShoppingMutation((id: number) => api<null>('DELETE', `/shopping/items/${id}`))

/** Abhaken oder zurücknehmen; die Liste zeigt es sofort, im Laden zählt jede Sekunde. */
export function useCheckItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, checked }: { id: number; checked: boolean }) =>
      api<ListItem>('PUT', `/shopping/list/${id}/checked`, { checked }),
    onMutate: async ({ id, checked }) => {
      await queryClient.cancelQueries({ queryKey: SHOPPING_LIST_KEY })
      const previous = queryClient.getQueryData<ShoppingList>(SHOPPING_LIST_KEY)
      if (previous)
        queryClient.setQueryData<ShoppingList>(SHOPPING_LIST_KEY, {
          items: previous.items.map((item) => (item.id === id ? { ...item, checked } : item)),
        })
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(SHOPPING_LIST_KEY, context.previous)
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: SHOPPING_LIST_KEY }),
        queryClient.invalidateQueries({ queryKey: SHOPPING_ITEMS_KEY }),
      ]),
  })
}
