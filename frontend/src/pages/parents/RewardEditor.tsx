import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import StarIcon from '~icons/fluent-emoji-flat/star'
import TrashIcon from '~icons/fluent-emoji-flat/wastebasket'

import { ApiError } from '../../api/client'
import type { Member } from '../../api/members'
import {
  REWARD_MAX_COST,
  type Reward,
  type RewardData,
  createReward,
  deleteReward,
  updateReward,
  useRewardsMutation,
} from '../../api/rewards'
import { Avatar } from '../../components/Avatar'
import { TaskIcon } from '../../components/TaskIcon'
import { Alert, Button, Switch, TextAreaField, TextField } from '../../components/ui'
import { errorMessage } from '../../errors'
import { iconId, iconLabel, iconName, suggestIcon } from '../../icons/catalog'
import { IconPicker } from './IconPicker'
import { Field, NumberStepper } from './formParts'

const DEFAULT_REWARD_ICON = iconId('wrapped-gift')

interface RewardEditorProps {
  /** Ohne `reward` wird eine neue Belohnung für `member` angelegt. */
  reward?: Reward
  member: Member
  onSaved: (name: string) => void
  onDeleted: (name: string) => void
  onCancel: () => void
}

export function RewardEditor({ reward, member, onSaved, onDeleted, onCancel }: RewardEditorProps) {
  const { t } = useTranslation()
  const [name, setName] = useState(reward?.name ?? '')
  // Bis Eltern selbst ein Symbol wählen, wird es aus dem Namen vorgeschlagen.
  const [chosenIcon, setChosenIcon] = useState<string | null>(reward?.icon ?? null)
  const [cost, setCost] = useState(reward?.cost ?? 10)
  const [description, setDescription] = useState(reward?.description ?? '')
  const [active, setActive] = useState(reward?.active ?? true)
  const [pickingIcon, setPickingIcon] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const icon = chosenIcon ?? suggestIcon(name) ?? DEFAULT_REWARD_ICON
  const save = useRewardsMutation((data: RewardData) =>
    reward ? updateReward(reward.id, data) : createReward(data),
  )
  const remove = useRewardsMutation((id: number) => deleteReward(id))
  const busy = save.isPending || remove.isPending
  const iconText = iconLabel(t, iconName(icon) ?? '')

  const nameError =
    submitted && !name.trim()
      ? errorMessage(t, 'validation.required')
      : save.error instanceof ApiError && save.error.fields.name
        ? errorMessage(t, save.error.fields.name)
        : undefined

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    if (!name.trim()) return
    save.mutate(
      {
        member_id: member.id,
        name: name.trim(),
        icon,
        description: description.trim(),
        cost,
        active,
      },
      { onSuccess: (saved) => onSaved(saved.name) },
    )
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex items-center gap-4">
        <Avatar name={member.name} color={member.color} src={member.avatar_url} />
        <h1 className="min-w-0 text-3xl font-extrabold break-words text-orange-600">
          {reward
            ? t('rewards.edit_title', { name: reward.name })
            : t('rewards.new_title', { name: member.name })}
        </h1>
      </header>

      <form
        className="flex flex-col gap-6 rounded-3xl bg-white p-6 shadow-sm"
        onSubmit={submit}
        noValidate
      >
        {save.isError && !(save.error instanceof ApiError && save.error.fields.name) && (
          <Alert>{errorMessage(t, save.error)}</Alert>
        )}
        {remove.isError && <Alert>{errorMessage(t, remove.error)}</Alert>}

        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
          <button
            type="button"
            onClick={() => setPickingIcon(true)}
            aria-label={`${t('tasks.change_icon')}: ${iconText}`}
            className="flex size-32 shrink-0 items-center justify-center rounded-3xl bg-orange-50 ring-2 ring-orange-200 transition-colors hover:bg-orange-100 focus-visible:outline-4 focus-visible:outline-orange-400"
          >
            <TaskIcon icon={icon} className="size-24" />
          </button>
          <div className="w-full">
            <TextField
              label={t('rewards.name')}
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              autoComplete="off"
              error={nameError}
            />
          </div>
        </div>

        <Field label={t('rewards.cost')}>
          <NumberStepper
            label={t('rewards.cost')}
            value={cost}
            min={1}
            max={REWARD_MAX_COST}
            onChange={setCost}
            decreaseLabel={t('tasks.fewer_points')}
            increaseLabel={t('tasks.more_points')}
            icon={<StarIcon className="size-8 shrink-0" aria-hidden="true" />}
          />
        </Field>

        <TextAreaField
          label={t('tasks.description')}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={500}
        />

        <div className="flex flex-col gap-1">
          <Switch checked={active} onChange={setActive} label={t('tasks.active')} showLabel />
          <p className="text-base text-slate-500">{t('rewards.active_hint')}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={busy}>
            {t('tasks.save')}
          </Button>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            {t('actions.cancel')}
          </Button>
        </div>
      </form>

      {reward &&
        (confirmDelete ? (
          <div className="flex flex-col gap-3 rounded-3xl bg-red-50 p-6">
            <p className="text-lg font-semibold text-red-800">
              {t('rewards.delete_confirm', { name: reward.name })}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="danger"
                disabled={busy}
                onClick={() =>
                  remove.mutate(reward.id, { onSuccess: () => onDeleted(reward.name) })
                }
              >
                {t('rewards.delete')}
              </Button>
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                {t('actions.cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="danger" className="self-start" onClick={() => setConfirmDelete(true)}>
            <TrashIcon className="size-7" aria-hidden="true" />
            {t('rewards.delete')}
          </Button>
        ))}

      {pickingIcon && (
        <IconPicker
          value={icon}
          initialCategory="rewards"
          onSelect={(value) => {
            setChosenIcon(value)
            setPickingIcon(false)
          }}
          onClose={() => setPickingIcon(false)}
        />
      )}
    </main>
  )
}
