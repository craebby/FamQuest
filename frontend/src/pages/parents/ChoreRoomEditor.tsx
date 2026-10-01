import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import TrashIcon from '~icons/fluent-emoji-flat/wastebasket'

import { ApiError } from '../../api/client'
import {
  type ChoreRoom,
  type RoomData,
  createRoom,
  deleteRoom,
  updateRoom,
  useChoresMutation,
} from '../../api/chores'
import { TaskIcon } from '../../components/TaskIcon'
import { Alert, Button, TextField } from '../../components/ui'
import { errorMessage } from '../../errors'
import { iconId, iconLabel, iconName, suggestIcon } from '../../icons/catalog'
import { IconPicker } from './IconPicker'

const DEFAULT_ROOM_ICON = iconId('house')

interface ChoreRoomEditorProps {
  /** Ohne `room` wird ein neuer Raum angelegt. */
  room?: ChoreRoom
  /** Anzahl der Aufgaben im Raum; sie verschwinden beim Löschen mit. */
  choreCount: number
  onSaved: (name: string) => void
  onDeleted: (name: string) => void
  onCancel: () => void
}

export function ChoreRoomEditor({
  room,
  choreCount,
  onSaved,
  onDeleted,
  onCancel,
}: ChoreRoomEditorProps) {
  const { t } = useTranslation()
  const [name, setName] = useState(room?.name ?? '')
  // Bis Eltern selbst ein Symbol wählen, wird es aus dem Namen vorgeschlagen.
  const [chosenIcon, setChosenIcon] = useState<string | null>(room?.icon ?? null)
  const [pickingIcon, setPickingIcon] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const icon = chosenIcon ?? suggestIcon(name) ?? DEFAULT_ROOM_ICON
  const save = useChoresMutation((data: RoomData) =>
    room ? updateRoom(room.id, data) : createRoom(data),
  )
  const remove = useChoresMutation((id: number) => deleteRoom(id))
  const busy = save.isPending || remove.isPending

  const duplicate = save.error instanceof ApiError && save.error.code === 'chore.room_duplicate'
  const fieldError = save.error instanceof ApiError ? save.error.fields.name : undefined
  const nameError =
    submitted && !name.trim()
      ? errorMessage(t, 'validation.required')
      : duplicate
        ? errorMessage(t, save.error)
        : fieldError
          ? errorMessage(t, fieldError)
          : undefined

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    if (!name.trim()) return
    save.mutate({ name: name.trim(), icon }, { onSuccess: (saved) => onSaved(saved.name) })
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <h1 className="min-w-0 text-3xl font-extrabold break-words text-orange-600">
        {room ? t('chores.edit_room', { name: room.name }) : t('chores.new_room')}
      </h1>

      <form
        className="flex flex-col gap-6 rounded-3xl bg-white p-6 shadow-sm"
        onSubmit={submit}
        noValidate
      >
        {save.isError && !nameError && <Alert>{errorMessage(t, save.error)}</Alert>}
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
              label={t('chores.room_name')}
              hint={t('chores.room_name_hint')}
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={60}
              autoComplete="off"
              error={nameError}
            />
          </div>
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

      {room &&
        (confirmDelete ? (
          <div className="flex flex-col gap-3 rounded-3xl bg-red-50 p-6">
            <p className="text-lg font-semibold text-red-800">
              {t('chores.delete_room_confirm', { name: room.name, count: choreCount })}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => remove.mutate(room.id, { onSuccess: () => onDeleted(room.name) })}
              >
                {t('chores.delete_room')}
              </Button>
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                {t('actions.cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="danger" className="self-start" onClick={() => setConfirmDelete(true)}>
            <TrashIcon className="size-7" aria-hidden="true" />
            {t('chores.delete_room')}
          </Button>
        ))}

      {pickingIcon && (
        <IconPicker
          value={icon}
          initialCategory="room"
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
