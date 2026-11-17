import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import GiftIcon from '~icons/fluent-emoji-flat/wrapped-gift'
import PawIcon from '~icons/fluent-emoji-flat/paw-prints'

import {
  type CompanionMode,
  companionFor,
  useCompanionMode,
  useCompanions,
  useResetCompanion,
} from '../../api/companions'
import type { Member } from '../../api/members'
import { Avatar } from '../../components/Avatar'
import { Alert, Button, Section } from '../../components/ui'
import { errorMessage } from '../../errors'
import { SPECIES_ICONS, SPECIES_STYLE } from '../companion/icons'
import { ChoiceTile } from './formParts'

const MODES: CompanionMode[] = ['both', 'companion', 'rewards']

/** Je Kind: Tier und Belohnungen, nur das Tier oder nur Belohnungen; Tier neu aussuchen lassen. */
export function CompanionSection({ childMembers }: { childMembers: Member[] }) {
  const { t } = useTranslation()
  const companions = useCompanions()
  const setMode = useCompanionMode()
  const reset = useResetCompanion()
  const [confirming, setConfirming] = useState<number | null>(null)

  if (childMembers.length === 0) return null

  return (
    <Section title={t('companion.section')}>
      <p className="text-lg text-slate-600">{t('companion.section_hint')}</p>
      {companions.isError && <Alert>{errorMessage(t, companions.error)}</Alert>}
      {setMode.isError && <Alert>{errorMessage(t, setMode.error)}</Alert>}
      {reset.isError && <Alert>{errorMessage(t, reset.error)}</Alert>}
      <ul className="flex flex-col gap-6">
        {childMembers.map((member) => {
          const companion = companionFor(companions.data, member.id)
          const Animal = companion?.species ? SPECIES_ICONS[companion.species] : null
          return (
            <li
              key={member.id}
              className="flex flex-col gap-3 rounded-2xl border-2 border-slate-100 p-3"
            >
              <div className="flex flex-wrap items-center gap-3">
                <Avatar name={member.name} color={member.color} src={member.avatar_url} />
                <span className="text-xl font-extrabold text-slate-800">{member.name}</span>
                {Animal && companion?.species && (
                  <span className="flex items-center gap-2 text-lg text-slate-600">
                    <Animal
                      className="size-10"
                      style={SPECIES_STYLE[companion.species]}
                      aria-hidden="true"
                    />
                    {companion.name || t(`companion.species.${companion.species}`)} ·{' '}
                    {t(`companion.stage.${companion.stage}`)} ·{' '}
                    {t('companion.care_days', { count: companion.care_days })}
                  </span>
                )}
              </div>
              <div
                role="radiogroup"
                aria-label={t('companion.mode_label', { name: member.name })}
                className="grid grid-cols-3 gap-2"
              >
                {MODES.map((mode) => (
                  <ChoiceTile
                    key={mode}
                    name={`companion-mode-${member.id}`}
                    checked={member.companion_mode === mode}
                    onChange={() => setMode.mutate({ memberId: member.id, mode })}
                  >
                    <span className="flex gap-1">
                      {mode !== 'rewards' && <PawIcon className="size-8" aria-hidden="true" />}
                      {mode !== 'companion' && <GiftIcon className="size-8" aria-hidden="true" />}
                    </span>
                    <span className="text-base">{t(`companion.mode.${mode}`)}</span>
                  </ChoiceTile>
                ))}
              </div>
              {companion?.species &&
                (confirming === member.id ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-lg font-bold text-slate-700">
                      {t('companion.reset_confirm', { name: member.name })}
                    </span>
                    <Button
                      variant="danger"
                      disabled={reset.isPending}
                      onClick={() =>
                        reset.mutate(member.id, { onSuccess: () => setConfirming(null) })
                      }
                    >
                      {t('companion.reset')}
                    </Button>
                    <Button variant="secondary" onClick={() => setConfirming(null)}>
                      {t('actions.cancel')}
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="secondary"
                    className="self-start"
                    onClick={() => setConfirming(member.id)}
                  >
                    {t('companion.reset')}
                  </Button>
                ))}
            </li>
          )
        })}
      </ul>
    </Section>
  )
}
