import { useQuery, useQueryClient } from '@tanstack/react-query'

import type { MemberColor } from '../memberColors'
import { api, apiGet } from './client'
import { useParentMutation } from './mutations'
import { TASKS_KEY } from './tasks'
import { TODAY_KEY } from './today'

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

/** Kinder der Familie; nur sie haben Belohnungen. */
export const childrenOf = (members: Member[]) => members.filter((member) => member.role === 'child')

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

/** Änderung an Familienmitgliedern; lädt danach Personen und (wegen Zuordnungen) Aufgaben neu. */
export function useMembersMutation<TVariables, TResult>(
  request: (variables: TVariables) => Promise<TResult>,
) {
  return useParentMutation(request, [MEMBERS_KEY, TASKS_KEY, TODAY_KEY])
}

export const reorderMembers = (memberIds: number[]) =>
  api<Member[]>('PUT', '/members/order', { member_ids: memberIds })

/** Neue Reihenfolge; die Liste ändert sich sofort, der Server bestätigt sie. */
export function useReorderMembers() {
  const queryClient = useQueryClient()
  const mutation = useMembersMutation(reorderMembers)
  return {
    ...mutation,
    move: (members: Member[], from: number, to: number) => {
      if (to < 0 || to >= members.length || from === to) return
      const next = [...members]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      queryClient.setQueryData(MEMBERS_KEY, next)
      mutation.mutate(next.map((member) => member.id))
    },
  }
}
