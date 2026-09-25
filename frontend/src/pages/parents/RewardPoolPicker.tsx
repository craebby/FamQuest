import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import StarIcon from '~icons/fluent-emoji-flat/star'
import CheckIcon from '~icons/lucide/check'

import type { Member } from '../../api/members'
import { type Reward, createRewards, useRewardsMutation } from '../../api/rewards'
import { Avatar } from '../../components/Avatar'
import { TaskIcon } from '../../components/TaskIcon'
import { Alert, Button } from '../../components/ui'
import { errorMessage } from '../../errors'
import { normalize } from '../../icons/catalog'
import {
  REWARD_POOL,
  REWARD_TIERS,
  rewardTemplateIcon,
  rewardTemplateName,
} from '../../pools/rewards'

interface RewardPoolPickerProps {
  member: Member
  /** Bereits vorhandene Belohnungen des Kindes; gleichnamige Vorschläge sind schon abgehakt. */
  existing: Reward[]
  onDone: (count: number) => void
  onCancel: () => void
}

/** Mehrere Belohnungen aus dem vorgegebenen Pool für ein Kind übernehmen. */
export function RewardPoolPicker({ member, existing, onDone, onCancel }: RewardPoolPickerProps) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<string[]>([])
  const add = useRewardsMutation(createRewards)
  const existingNames = new Set(existing.map((reward) => normalize(reward.name.trim())))
  const templates = REWARD_POOL.map((template) => {
    const name = rewardTemplateName(t, template)
    return { ...template, name, present: existingNames.has(normalize(name)) }
  })

  const toggle = (id: string) =>
    setSelected((ids) => (ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]))

  const submit = () =>
    add.mutate(
      templates
        .filter((template) => selected.includes(template.id))
        .map((template) => ({
          member_id: member.id,
          name: template.name,
          icon: rewardTemplateIcon(template),
          description: '',
          cost: template.cost,
          active: true,
        })),
      { onSuccess: (created) => onDone(created.length) },
    )

  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-6 p-4 pb-32 sm:p-6 sm:pb-32">
      <header className="flex items-center gap-4">
        <Avatar name={member.name} color={member.color} src={member.avatar_url} />
        <h1 className="min-w-0 text-3xl font-extrabold break-words text-orange-600">
          {t('rewards.pool_title', { name: member.name })}
        </h1>
      </header>
      <p className="text-lg text-slate-600">{t('rewards.pool_intro')}</p>
      {add.isError && <Alert>{errorMessage(t, add.error)}</Alert>}

      {REWARD_TIERS.map((tier) => (
        <section
          key={tier}
          className="flex flex-col gap-3 rounded-3xl bg-white p-4 shadow-sm sm:p-6"
        >
          <h2 className="text-2xl font-extrabold text-slate-800">{t(`rewards.tier_${tier}`)}</h2>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-3">
            {templates
              .filter((template) => template.tier === tier)
              .map((template) => {
                const checked = template.present || selected.includes(template.id)
                return (
                  <li key={template.id}>
                    <label className={template.present ? 'cursor-not-allowed' : 'cursor-pointer'}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={template.present || add.isPending}
                        onChange={() => toggle(template.id)}
                        className="peer sr-only"
                      />
                      <span className="relative flex h-full min-h-40 flex-col items-center gap-2 rounded-2xl border-2 border-slate-200 p-3 text-center peer-checked:border-orange-500 peer-checked:bg-orange-50 peer-focus-visible:outline-4 peer-focus-visible:outline-orange-400 peer-disabled:opacity-60">
                        {checked && (
                          <span className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-full bg-orange-500 text-white">
                            <CheckIcon className="size-5" strokeWidth={4} aria-hidden="true" />
                          </span>
                        )}
                        <TaskIcon icon={rewardTemplateIcon(template)} className="size-14" />
                        <span className="text-lg leading-tight font-bold break-words hyphens-auto text-slate-800">
                          {template.name}
                        </span>
                        <span className="mt-auto flex items-center gap-1 font-extrabold text-slate-700">
                          <StarIcon className="size-6" aria-hidden="true" />
                          <span aria-hidden="true">{template.cost}</span>
                          <span className="sr-only">
                            {t('tasks.points_count', { count: template.cost })}
                          </span>
                        </span>
                        {template.present && (
                          <span className="text-sm font-bold text-slate-500">
                            {t('rewards.pool_present')}
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                )
              })}
          </ul>
        </section>
      ))}

      <div className="fixed inset-x-0 bottom-0 z-10 flex flex-wrap justify-center gap-3 border-t border-orange-100 bg-white/95 p-4 backdrop-blur">
        <Button onClick={submit} disabled={selected.length === 0 || add.isPending}>
          {t('rewards.pool_add', { count: selected.length })}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={add.isPending}>
          {t('actions.cancel')}
        </Button>
      </div>
    </main>
  )
}
