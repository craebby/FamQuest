import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import CheckIcon from '~icons/fluent-emoji-flat/check-mark-button'
import CrossIcon from '~icons/fluent-emoji-flat/cross-mark'
import PartyIcon from '~icons/fluent-emoji-flat/party-popper'
import StarIcon from '~icons/fluent-emoji-flat/star'

import type { Member } from '../../api/members'
import { type Reward, useRedeem } from '../../api/rewards'
import { Avatar } from '../../components/Avatar'
import { TaskIcon } from '../../components/TaskIcon'
import { errorMessage } from '../../errors'
import { colorTokens } from '../../memberColors'

/** So lange bleibt die Erfolgsmeldung stehen, bevor sich der Dialog von selbst schließt. */
export const REDEEM_SUCCESS_MS = 4000

interface RedeemDialogProps {
  reward: Reward
  member: Member
  onClose: () => void
}

/** Einlösen bestätigen: großes Symbol, Kosten, Haken oder Kreuz; danach kurz feiern. */
export function RedeemDialog({ reward, member, onClose }: RedeemDialogProps) {
  const { t } = useTranslation()
  const redeem = useRedeem()
  const dialog = useRef<HTMLDivElement>(null)
  const tokens = colorTokens(member.color)
  const done = redeem.isSuccess

  useEffect(() => {
    dialog.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (!done) return
    const timer = window.setTimeout(onClose, REDEEM_SUCCESS_MS)
    return () => window.clearTimeout(timer)
  }, [done, onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="redeem-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4"
    >
      <div
        ref={dialog}
        tabIndex={-1}
        className="relative flex w-full max-w-lg flex-col items-center gap-5 rounded-3xl bg-white p-6 text-center shadow-xl outline-none sm:p-8"
      >
        {done ? (
          <>
            <PartyIcon className="size-32 motion-safe:animate-pop" aria-hidden="true" />
            <h2 id="redeem-title" className="text-3xl font-extrabold text-slate-800">
              {t('rewards.enjoy', { name: reward.name })}
            </h2>
            <span
              aria-hidden="true"
              className="flex items-center gap-1 rounded-full px-4 py-1 text-3xl font-extrabold shadow-md motion-safe:animate-pop"
              style={{ backgroundColor: tokens.main, color: tokens.onMain }}
            >
              −{reward.cost}
              <StarIcon className="size-[1.2em]" />
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('rewards.close')}
              className="flex size-24 items-center justify-center rounded-3xl bg-emerald-100 focus-visible:outline-4 focus-visible:outline-orange-400 active:scale-95 motion-reduce:active:scale-100"
            >
              <CheckIcon className="size-16" aria-hidden="true" />
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <Avatar name={member.name} color={member.color} src={member.avatar_url} />
              <TaskIcon icon={reward.icon} className="size-32" />
            </div>
            <h2 id="redeem-title" className="text-3xl font-extrabold text-slate-800">
              {t('rewards.confirm_title', { name: reward.name })}
            </h2>
            <p className="flex items-center gap-1 text-3xl font-extrabold text-slate-700">
              <StarIcon className="size-10" aria-hidden="true" />
              <span aria-hidden="true">−{reward.cost}</span>
              <span className="sr-only">{t('rewards.confirm_cost', { count: reward.cost })}</span>
            </p>
            {redeem.isError && (
              <p role="alert" className="text-lg font-semibold text-red-700">
                {errorMessage(t, redeem.error)}
              </p>
            )}
            <div className="grid w-full grid-cols-2 gap-4">
              <button
                type="button"
                onClick={onClose}
                disabled={redeem.isPending}
                aria-label={t('actions.cancel')}
                className="flex min-h-28 flex-col items-center justify-center gap-1 rounded-3xl bg-slate-100 text-xl font-bold text-slate-700 focus-visible:outline-4 focus-visible:outline-orange-400 active:scale-95 disabled:opacity-50 motion-reduce:active:scale-100"
              >
                <CrossIcon className="size-14" aria-hidden="true" />
                {t('actions.cancel')}
              </button>
              <button
                type="button"
                onClick={() => redeem.mutate(reward)}
                disabled={redeem.isPending}
                aria-label={t('rewards.confirm')}
                className="flex min-h-28 flex-col items-center justify-center gap-1 rounded-3xl text-xl font-extrabold focus-visible:outline-4 focus-visible:outline-orange-400 active:scale-95 disabled:opacity-50 motion-reduce:active:scale-100"
                style={{ backgroundColor: tokens.main, color: tokens.onMain }}
              >
                <CheckIcon className="size-14" aria-hidden="true" />
                {t('rewards.confirm')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
