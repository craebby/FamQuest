import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { MemberColor } from '../memberColors'
import { ME_KEY } from './auth'
import { ApiError, api, apiGet } from './client'

// Muss zu MEMBER_ROLES im Backend passen (backend/app/schemas.py).
export const MEMBER_ROLES = ['parent', 'child'] as const
export type MemberRole = (typeof MEMBER_ROLES)[number]

export interface Member {
  id: number
  name: string
  role: MemberRole
  color: MemberColor
  avatar_url: string | null
}

export interface MemberData {
  name: string
  role: MemberRole
  color: MemberColor
}

export const MEMBERS_KEY = ['members'] as const

export function useMembers() {
  return useQuery({ queryKey: MEMBERS_KEY, queryFn: () => apiGet<Member[]>('/members') })
}

export const createMember = (data: MemberData) => api<Member>('POST', '/members', data)
export const updateMember = (id: number, data: MemberData) =>
  api<Member>('PUT', `/members/${id}`, data)
export const deleteMember = (id: number) => api<void>('DELETE', `/members/${id}`)
export const uploadAvatar = (id: number, image: Blob) =>
  api<Member>('PUT', `/members/${id}/avatar`, image)
export const removeAvatar = (id: number) => api<Member>('DELETE', `/members/${id}/avatar`)

/** Änderung an Familienmitgliedern; lädt danach die Liste neu. */
export function useMembersMutation<TVariables, TResult>(
  request: (variables: TVariables) => Promise<TResult>,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: request,
    onSettled: () => queryClient.invalidateQueries({ queryKey: MEMBERS_KEY }),
    onError: (error) => {
      // Entsperrung abgelaufen oder abgemeldet: /auth/me neu laden, damit die PIN-Abfrage erscheint.
      if (error instanceof ApiError && (error.status === 401 || error.code === 'parent.locked')) {
        void queryClient.invalidateQueries({ queryKey: ME_KEY })
      }
    },
  })
}
