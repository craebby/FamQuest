import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import TrashIcon from '~icons/fluent-emoji-flat/wastebasket'

import { ApiError } from '../../api/client'
import {
  type Chore,
  type ChoreRoom,
  START_STATES,
  type StartState,
  createChore,
  deleteChore,
  updateChore,
  useChoresMutation,
} from '../../api/chores'
import {
  INTERVAL_UNIT_NAMES,
  type IntervalUnit,
  intervalDays,
  intervalText,
  maxCount,
  splitInterval,
} from '../../chores'
import { TaskIcon } from '../../components/TaskIcon'
import { Alert, Button, Switch, TextField } from '../../components/ui'
import { errorMessage } from '../../errors'
import { iconId, iconLabel, iconName, suggestIcon } from '../../icons/catalog'
import { IconPicker } from './IconPicker'
import { ChoiceTile, Field, FilterChip, NumberStepper } from './formParts'

const DEFAULT_CHORE_ICON = iconId('broom')

interface ChoreEditorProps {
  /** Ohne `chore` wird eine neue Aufgabe im Raum `roomId` angelegt. */
  chore?: Chore
  roomId: number
  rooms: ChoreRoom[]
  onSaved: (title: string) => void
  onDeleted: (title: string) => void
  onCancel: () => void
}

export function ChoreEditor({
  chore,
  roomId: initialRoomId,
  rooms,
  onSaved,
  onDeleted,
  onCancel,
}: ChoreEditorProps) {
  const { t } = useTranslation()
  const [title, setTitle] = useState(chore?.title ?? '')
  // Bis Eltern selbst ein Symbol wählen, wird es aus dem Titel vorgeschlagen.
  const [chosenIcon, setChosenIcon] = useState<string | null>(chore?.icon ?? null)
  const [roomId, setRoomId] = useState(chore?.room_id ?? initialRoomId)
  const [every, setEvery] = useState(() => splitInterval(chore?.interval_days ?? 14))
  const [state, setState] = useState<StartState>('half')
  const [active, setActive] = useState(chore?.active ?? true)
  const [pickingIcon, setPickingIcon] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const icon = chosenIcon ?? suggestIcon(title) ?? DEFAULT_CHORE_ICON
  const days = intervalDays(every.count, every.unit)
  const save = useChoresMutation(() => {
    const data = { room_id: roomId, title: title.trim(), icon, interval_days: days, active }
    return chore ? updateChore(chore.id, data) : createChore({ ...data, state })
  })
  const remove = useChoresMutation((id: number) => deleteChore(id))
  const busy = save.isPending || remove.isPending

  const fieldError = save.error instanceof ApiError ? save.error.fields.title : undefined
  const titleError =
    submitted && !title.trim()
      ? errorMessage(t, 'validation.required')
      : fieldError
        ? errorMessage(t, fieldError)
        : undefined

  const setUnit = (unit: IntervalUnit) =>
    setEvery(({ count }) => ({ unit, count: Math.min(count, maxCount(unit)) }))

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    if (!title.trim()) return
    save.mutate(undefined, { onSuccess: (saved) => onSaved(saved.title) })
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <h1 className="min-w-0 text-3xl font-extrabold break-words text-orange-600">
        {chore ? t('chores.edit_title', { title: chore.title }) : t('chores.new_title')}
      </h1>

      <form
        className="flex flex-col gap-6 rounded-3xl bg-white p-6 shadow-sm"
        onSubmit={submit}
        noValidate
      >
        {save.isError && !fieldError && <Alert>{errorMessage(t, save.error)}</Alert>}
        {remove.isError && <Alert>{errorMessage(t, remove.error)}</Alert>}

        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
          <button
            type="button"
            onClick={() => setPickingIcon(true)}
            aria-label={`${t('tasks.change_icon')}: ${iconLabel(t, iconName(icon) ?? '')}`}
            className="flex size-32 shrink-0 items-center justify-center rounded-3xl bg-orange-50 ring-2 ring-orange-200 transition-colors hover:bg-orange-100 focus-visible:outline-4 focus-visible:outline-orange-400"
          >
            <TaskIcon icon={icon} className="size-24" />
          </button>
          <div className="w-full">
            <TextField
              label={t('chores.chore_title')}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={100}
              autoComplete="off"
              error={titleError}
            />
          </div>
        </div>

        <Field label={t('chores.room')}>
          <div className="-mx-1 flex flex-wrap gap-2 px-1 py-1">
            {rooms.map((room) => (
              <FilterChip
                key={room.id}
                pressed={room.id === roomId}
                onClick={() => setRoomId(room.id)}
              >
                <TaskIcon icon={room.icon} className="size-10" />
                {room.name}
              </FilterChip>
            ))}
          </div>
        </Field>

        <Field label={t('chores.interval')}>
          <NumberStepper
            label={t('chores.interval_count')}
            value={every.count}
            min={1}
            max={maxCount(every.unit)}
            onChange={(count) => setEvery(({ unit }) => ({ unit, count }))}
            decreaseLabel={t('chores.interval_less')}
            increaseLabel={t('chores.interval_more')}
          />
          <div
            role="group"
            aria-label={t('chores.interval_unit')}
            className="-mx-1 flex flex-wrap gap-2 px-1 py-1"
          >
            {INTERVAL_UNIT_NAMES.map((unit) => (
              <button
                key={unit}
                type="button"
                aria-pressed={every.unit === unit}
                onClick={() => setUnit(unit)}
                className="min-h-14 rounded-full px-5 text-lg font-bold text-slate-700 ring-2 ring-slate-200 focus-visible:outline-4 focus-visible:outline-orange-400 aria-pressed:bg-orange-500 aria-pressed:text-white aria-pressed:ring-orange-500"
              >
                {t(`chores.unit_${unit}`, { count: every.count })}
              </button>
            ))}
          </div>
          <p className="text-base text-slate-500">
            {t('chores.interval_hint', { interval: intervalText(t, days) })}
          </p>
        </Field>

        {!chore && (
          <Field label={t('chores.state')}>
            <div className="grid grid-cols-3 gap-3">
              {START_STATES.map((value) => (
                <ChoiceTile
                  key={value}
                  name="chore-state"
                  checked={state === value}
                  onChange={() => setState(value)}
                >
                  {t(`chores.state_${value}`)}
                </ChoiceTile>
              ))}
            </div>
          </Field>
        )}

        <div className="flex flex-col gap-1">
          <Switch checked={active} onChange={setActive} label={t('tasks.active')} showLabel />
          <p className="text-base text-slate-500">{t('chores.active_hint')}</p>
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

      {chore &&
        (confirmDelete ? (
          <div className="flex flex-col gap-3 rounded-3xl bg-red-50 p-6">
            <p className="text-lg font-semibold text-red-800">
              {t('chores.delete_confirm', { title: chore.title })}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => remove.mutate(chore.id, { onSuccess: () => onDeleted(chore.title) })}
              >
                {t('chores.delete')}
              </Button>
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                {t('actions.cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="danger" className="self-start" onClick={() => setConfirmDelete(true)}>
            <TrashIcon className="size-7" aria-hidden="true" />
            {t('chores.delete')}
          </Button>
        ))}

      {pickingIcon && (
        <IconPicker
          value={icon}
          initialCategory="household"
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
