import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import GiftIcon from '~icons/fluent-emoji-flat/wrapped-gift'

import type { Member } from '../../api/members'
import { type Reward, rewardsFor, useRewards } from '../../api/rewards'
import { Alert } from '../../components/ui'
import { errorMessage } from '../../errors'
import { RedeemDialog } from './RedeemDialog'
import { RewardCard } from './RewardCard'

/** Belohnungskarten eines Kindes; ein Tipp auf „Einlösen“ öffnet die Bestätigung. */
export function RewardGrid({ member, balance }: { member: Member; balance: number }) {
  const { t } = useTranslation()
  const rewards = useRewards()
  const [selected, setSelected] = useState<Reward | null>(null)
  const close = useCallback(() => setSelected(null), [])

  if (rewards.isPending) {
    return (
      <p role="status" className="text-xl text-slate-600">
        {t('common.loading')}
      </p>
    )
  }
  if (rewards.isError) return <Alert>{errorMessage(t, rewards.error)}</Alert>

  const own = rewardsFor(rewards.data, member.id)
  if (own.length === 0) {
    return (
      <p className="flex flex-col items-center gap-3 py-8 text-center text-2xl font-bold text-slate-600">
        <GiftIcon className="size-24 opacity-60" aria-hidden="true" />
        {t('rewards.none_yet')}
      </p>
    )
  }

  return (
    <>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-4">
        {own.map((reward) => (
          <RewardCard
            key={reward.id}
            reward={reward}
            member={member}
            balance={balance}
            onRedeem={() => setSelected(reward)}
          />
        ))}
      </ul>
      {selected && <RedeemDialog reward={selected} member={member} onClose={close} />}
    </>
  )
}
