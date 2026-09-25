import { type QueryKey, useMutation, useQueryClient } from '@tanstack/react-query'

import { ME_KEY } from './auth'
import { ApiError } from './client'

/** Änderung im Elternbereich; lädt danach die betroffenen Abfragen neu. */
export function useParentMutation<TVariables, TResult>(
  request: (variables: TVariables) => Promise<TResult>,
  invalidates: QueryKey[],
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: request,
    onSettled: () =>
      Promise.all(invalidates.map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
    onError: (error) => {
      // Entsperrung abgelaufen oder abgemeldet: /auth/me neu laden, damit die PIN-Abfrage erscheint.
      if (error instanceof ApiError && (error.status === 401 || error.code === 'parent.locked')) {
        void queryClient.invalidateQueries({ queryKey: ME_KEY })
      }
    },
  })
}
