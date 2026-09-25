import { useTranslation } from 'react-i18next'
import StarIcon from '~icons/fluent-emoji-flat/star'
import GiftIcon from '~icons/fluent-emoji-flat/wrapped-gift'

import type { Member } from '../../api/members'
import type { Reward } from '../../api/rewards'
import { TaskIcon } from '../../components/TaskIcon'
import { colorTokens } from '../../memberColors'

interface RewardCardProps {
  reward: Reward
  member: Member
  /** Aktueller Punktestand des Kindes. */
  balance: number
  onRedeem: () => void
}

/** Große Belohnungskarte: mit genug Punkten „Einlösen“, sonst wie viele noch fehlen. */
export function RewardCard({ reward, member, balance, onRedeem }: RewardCardProps) {
  const { t } = useTranslation()
  const tokens = colorTokens(member.color)
  const missing = reward.cost - balance
  const affordable = missing <= 0

  return (
    <li
      className="flex flex-col items-center gap-3 rounded-3xl border-4 bg-white p-4 text-center shadow-sm"
      style={{ borderColor: affordable ? tokens.main : 'transparent' }}
    >
      <TaskIcon icon={reward.icon} className="size-24" />
      <h3 className="text-2xl font-extrabold break-words hyphens-auto text-slate-800">
        {reward.name}
      </h3>
      <p className="flex items-center gap-1 text-2xl font-extrabold text-slate-700">
        <StarIcon className="size-8" aria-hidden="true" />
        <span aria-hidden="true">{reward.cost}</span>
        <span className="sr-only">{t('tasks.points_count', { count: reward.cost })}</span>
      </p>
      {affordable ? (
        <button
          type="button"
          onClick={onRedeem}
          aria-label={t('rewards.redeem_label', { name: reward.name })}
          className="mt-auto flex min-h-20 w-full items-center justify-center gap-3 rounded-2xl px-4 text-2xl font-extrabold shadow-sm transition-transform focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-orange-400 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
          style={{ backgroundColor: tokens.main, color: tokens.onMain }}
        >
          <GiftIcon className="size-10" aria-hidden="true" />
          {t('rewards.redeem')}
        </button>
      ) : (
        <div className="mt-auto flex w-full flex-col items-center gap-2">
          <span
            role="img"
            aria-label={t('rewards.progress', { balance, cost: reward.cost })}
            className="block h-5 w-full overflow-hidden rounded-full bg-slate-100 shadow-inner"
          >
            <span
              className="block h-full rounded-full"
              style={{
                width: `${Math.max(0, (balance / reward.cost) * 100)}%`,
                backgroundColor: tokens.main,
              }}
            />
          </span>
          <span className="text-lg font-bold text-balance text-slate-600">
            {t('rewards.missing', { count: missing })}
          </span>
        </div>
      )}
    </li>
  )
}
