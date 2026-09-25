import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { ApiError, api, apiGet, setCsrfToken } from './client'

export interface Me {
  user: { email: string; role: string; language: string | null }
  family: { name: string; default_language: string; timezone: string; pin_enabled: boolean }
  csrf_token: string
  parent_unlocked: boolean
}

export interface SetupData {
  language: string
  family_name: string
  email: string
  password: string
  pin: string
  timezone: string
}

export const ME_KEY = ['me'] as const
const SETUP_STATUS_KEY = ['setup-status'] as const

export function useSetupStatus() {
  return useQuery({
    queryKey: SETUP_STATUS_KEY,
    queryFn: () => apiGet<{ setup_required: boolean }>('/setup/status'),
    staleTime: Infinity,
  })
}

export function useMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: async () => {
      const me = await apiGet<Me>('/auth/me')
      setCsrfToken(me.csrf_token)
      return me
    },
    retry: (count, error) => !(error instanceof ApiError && error.status === 401) && count < 2,
  })
}

/** Mutation, deren Antwort der neue /auth/me-Stand ist. */
function useMeMutation<TVariables>(
  request: (variables: TVariables) => Promise<Me>,
  afterSuccess?: (queryClient: QueryClient) => void,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: request,
    onSuccess: (me) => {
      setCsrfToken(me.csrf_token)
      queryClient.setQueryData(ME_KEY, me)
      afterSuccess?.(queryClient)
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) {
        void queryClient.invalidateQueries({ queryKey: ME_KEY })
      }
    },
  })
}

export const useSetup = () =>
  useMeMutation(
    (data: SetupData) => api<Me>('POST', '/setup', data),
    (queryClient) => queryClient.setQueryData(SETUP_STATUS_KEY, { setup_required: false }),
  )

export const useLogin = () =>
  useMeMutation((data: { email: string; password: string }) => api<Me>('POST', '/auth/login', data))

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api<void>('POST', '/auth/logout'),
    onSuccess: () => {
      setCsrfToken(null)
      queryClient.removeQueries({ queryKey: ME_KEY })
    },
  })
}

export const useUnlockParent = () =>
  useMeMutation((pin: string) => api<Me>('POST', '/parent/unlock', { pin }))

export const useLockParent = () => useMeMutation(() => api<Me>('POST', '/parent/lock'))

export const useSetPin = () =>
  useMeMutation((pin: string) => api<Me>('PUT', '/parent/pin', { pin }))

export const useDisablePin = () => useMeMutation(() => api<Me>('DELETE', '/parent/pin'))

export const useResetPin = () =>
  useMeMutation((data: { password: string; pin: string }) =>
    api<Me>('POST', '/parent/pin/reset', data),
  )
