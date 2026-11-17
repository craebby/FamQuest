import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, apiGet } from './client'
import { MEMBERS_KEY } from './members'
import { useParentMutation } from './mutations'
import { TODAY_KEY } from './today'

// Muss zu den Listen in backend/app/companions.py passen.
export const SPECIES = [
  'cat',
  'dog',
  'fox',
  'dragon',
  'unicorn',
  'horse',
  'snow_leopard',
  'giraffe',
  'turtle',
  'shark',
  'dolphin',
  'panda',
  'rabbit',
  'penguin',
  'koala',
] as const
export type Species = (typeof SPECIES)[number]
export type Stage = 'egg' | 'baby' | 'kid' | 'grown'
export type Trick =
  'spin' | 'jump' | 'music' | 'bubbles' | 'rainbow' | 'fireworks' | 'rocket' | 'magic'
export type ItemSlot = 'head' | 'face' | 'toy' | 'place'
export type CompanionMode = 'both' | 'companion' | 'rewards'

export interface CompanionItem {
  key: string
  slot: ItemSlot
  cost: number
}

export interface Companion {
  member_id: number
  mode: CompanionMode
  /** null = noch kein Tier ausgesucht. */
  species: Species | null
  name: string
  stage: Stage
  /** Tage mit mindestens einer Erledigung seit dem Aussuchen. */
  care_days: number
  next_stage_at: number | null
  tricks: Trick[]
  next_trick_at: number | null
  owned: string[]
  equipped: Partial<Record<ItemSlot, string>>
}

export interface Companions {
  species: Species[]
  items: CompanionItem[]
  companions: Companion[]
}

/** Ab so vielen Pflegetagen beginnt eine Stufe (wie STAGES im Backend). */
export const STAGE_STARTS: Record<Stage, number> = { egg: 0, baby: 2, kid: 14, grown: 30 }

export const COMPANIONS_KEY = ['companions'] as const

export function useCompanions() {
  return useQuery({ queryKey: COMPANIONS_KEY, queryFn: () => apiGet<Companions>('/companions') })
}

export const companionFor = (data: Companions | undefined, memberId: number) =>
  data?.companions.find((companion) => companion.member_id === memberId)

/** Am Display ohne Eltern-PIN, wie das Einlösen von Belohnungen. */
function useDisplayMutation<TVariables>(request: (variables: TVariables) => Promise<Companion>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: request,
    onSuccess: (companion) => {
      queryClient.setQueryData<Companions>(COMPANIONS_KEY, (data) =>
        data
          ? {
              ...data,
              companions: data.companions.map((entry) =>
                entry.member_id === companion.member_id ? companion : entry,
              ),
            }
          : data,
      )
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: COMPANIONS_KEY }),
        queryClient.invalidateQueries({ queryKey: TODAY_KEY }),
      ]),
  })
}

export function useChooseCompanion(memberId: number) {
  return useDisplayMutation((body: { species: Species; name: string }) =>
    api<Companion>('PUT', `/members/${memberId}/companion`, body),
  )
}

export function useBuyItem(memberId: number) {
  return useDisplayMutation((item: string) =>
    api<Companion>('POST', `/members/${memberId}/companion/items/${item}`),
  )
}

export function useWearItem(memberId: number) {
  return useDisplayMutation(({ item, worn }: { item: string; worn: boolean }) =>
    api<Companion>('PUT', `/members/${memberId}/companion/items/${item}`, { worn }),
  )
}

export function useCompanionMode() {
  return useParentMutation(
    ({ memberId, mode }: { memberId: number; mode: CompanionMode }) =>
      api<Companion>('PUT', `/members/${memberId}/companion-mode`, { mode }),
    [COMPANIONS_KEY, MEMBERS_KEY],
  )
}

export function useResetCompanion() {
  return useParentMutation(
    (memberId: number) => api<void>('DELETE', `/members/${memberId}/companion`),
    [COMPANIONS_KEY],
  )
}

/** Ab so vielen Pflegetagen kann das große Tier ein Kunststück (wie TRICKS im Backend). */
export const TRICK_STARTS: Record<Trick, number> = {
  spin: 4,
  jump: 8,
  music: 17,
  bubbles: 22,
  rainbow: 27,
  fireworks: 36,
  rocket: 46,
  magic: 60,
}
