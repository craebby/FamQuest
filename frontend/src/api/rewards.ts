import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, apiGet } from './client'
import { useParentMutation } from './mutations'
import { POINTS_KEY } from './points'
import { TODAY_KEY, type Today } from './today'

// Muss zu REWARD_MAX_COST im Backend passen (backend/app/schemas.py).
export const REWARD_MAX_COST = 1000

export interface RewardData {
  /** Kind, dem die Belohnung gehört. */
  member_id: number
  name: string
  icon: string
  description: string
  cost: number
  active: boolean
}

export interface Reward extends RewardData {
  id: number
}

// Muss zu REDEMPTION_STATUSES im Backend passen.
export type RedemptionStatus = 'redeemed'

export interface Redemption {
  id: number
  /** null, wenn die Belohnung inzwischen gelöscht ist. */
  reward_id: number | null
  member_id: number
  status: RedemptionStatus
  reward_name: string
  reward_icon: string
  cost: number
  created_at: string
}

interface RedemptionHistory {
  redemptions: Redemption[]
  has_more: boolean
}

/** Aktive Belohnungen eines Kindes, günstigste zuerst. */
export function rewardsFor(rewards: Reward[], memberId: number) {
  return rewards
    .filter((reward) => reward.member_id === memberId && reward.active)
    .sort((a, b) => a.cost - b.cost || a.id - b.id)
}

export const REWARDS_KEY = ['rewards'] as const
export const REDEMPTIONS_KEY = ['redemptions'] as const

export function useRewards() {
  return useQuery({ queryKey: REWARDS_KEY, queryFn: () => apiGet<Reward[]>('/rewards') })
}

export const createReward = (data: RewardData) => api<Reward>('POST', '/rewards', data)
export const updateReward = (id: number, data: RewardData) =>
  api<Reward>('PUT', `/rewards/${id}`, data)
export const deleteReward = (id: number) => api<void>('DELETE', `/rewards/${id}`)

export function rewardData({ id: _id, ...data }: Reward): RewardData {
  return data
}

/** Mehrere Belohnungen nacheinander anlegen (Auswahl aus dem Pool). */
export async function createRewards(list: RewardData[]) {
  const created: Reward[] = []
  for (const data of list) created.push(await createReward(data))
  return created
}

export function useRewardsMutation<TVariables, TResult>(
  request: (variables: TVariables) => Promise<TResult>,
) {
  return useParentMutation(request, [REWARDS_KEY])
}

/** Einlösungen eines Kindes (oder aller), neueste zuerst; ältere per `fetchNextPage`. */
export function useRedemptions(memberId: number | null) {
  return useInfiniteQuery({
    queryKey: [...REDEMPTIONS_KEY, memberId],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams()
      if (memberId !== null) params.set('member_id', String(memberId))
      if (pageParam !== null) params.set('before', String(pageParam))
      const query = params.toString()
      return apiGet<RedemptionHistory>(`/redemptions${query ? `?${query}` : ''}`)
    },
    initialPageParam: null as number | null,
    getNextPageParam: (page) => (page.has_more ? (page.redemptions.at(-1)?.id ?? null) : null),
  })
}

/** Belohnung am Display einlösen; der Punktestand sinkt sofort, der Server hat das letzte Wort. */
export function useRedeem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (reward: Reward) => api<Redemption>('POST', `/rewards/${reward.id}/redeem`),
    onSuccess: (redemption) => {
      queryClient.setQueryData<Today>(
        TODAY_KEY,
        (today) =>
          today && {
            ...today,
            points: today.points.map((entry) =>
              entry.member_id === redemption.member_id
                ? { ...entry, total: entry.total - redemption.cost }
                : entry,
            ),
          },
      )
    },
    onSettled: () =>
      Promise.all(
        [TODAY_KEY, REWARDS_KEY, POINTS_KEY, REDEMPTIONS_KEY].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      ),
  })
}
