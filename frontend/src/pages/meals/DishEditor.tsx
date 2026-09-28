import { type FormEvent, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import CameraIcon from '~icons/fluent-emoji-flat/camera'

import { type Dish, useDeleteDish, useDishImage, useUpdateDish } from '../../api/meals'
import { AvatarCropper } from '../../components/AvatarCropper'
import { DishPicture } from '../../components/DishPicture'
import { TaskIcon } from '../../components/TaskIcon'
import { Alert, Button, TextField } from '../../components/ui'
import { errorMessage } from '../../errors'
import { IconPicker } from '../parents/IconPicker'

interface DishEditorProps {
  dish: Dish
  onBack: () => void
}

/** Ein Gericht der Familie ändern: Name, Symbol, eigenes Foto; oder löschen. */
export function DishEditor({ dish, onBack }: DishEditorProps) {
  const { t } = useTranslation()
  const [name, setName] = useState(dish.name)
  const [icon, setIcon] = useState(dish.icon)
  const [picking, setPicking] = useState(false)
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const update = useUpdateDish()
  const image = useDishImage()
  const remove = useDeleteDish()
  const busy = update.isPending || image.isPending || remove.isPending
  const error = update.error ?? image.error ?? remove.error

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    update.mutate({ id: dish.id, name: name.trim(), icon }, { onSuccess: onBack })
  }

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-1">
      {error ? <Alert>{errorMessage(t, error)}</Alert> : null}

      <TextField
        label={t('meals.dish_name')}
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={100}
        required
      />

      <div className="flex flex-col gap-2">
        <span className="text-base font-bold text-slate-700">{t('meals.picture')}</span>
        <p className="-mt-1 text-base text-slate-500">{t('meals.picture_hint')}</p>
        <div className="flex flex-wrap items-center gap-3">
          <DishPicture icon={icon} imageUrl={dish.image_url} className="size-24" />
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            data-testid="dish-photo-input"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) setCropFile(file)
            }}
          />
          <Button variant="secondary" disabled={busy} onClick={() => fileInput.current?.click()}>
            <CameraIcon className="size-8" aria-hidden="true" />
            {t(dish.image_url ? 'members.change_photo' : 'members.choose_photo')}
          </Button>
          {dish.image_url ? (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => image.mutate({ id: dish.id, image: null })}
            >
              {t('members.remove_photo')}
            </Button>
          ) : (
            <Button variant="secondary" disabled={busy} onClick={() => setPicking(true)}>
              <TaskIcon icon={icon} className="size-8" />
              {t('meals.change_icon')}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={busy || !name.trim()}>
          {t('actions.save')}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={onBack}>
          {t('actions.back')}
        </Button>
      </div>

      <div className="mt-auto flex flex-col gap-3 border-t-2 border-slate-100 pt-4">
        {confirmDelete ? (
          <div className="flex flex-col gap-3 rounded-2xl bg-red-50 p-4">
            <p className="text-lg font-semibold text-red-800">
              {t('meals.delete_confirm', { name: dish.name })}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => remove.mutate(dish.id, { onSuccess: onBack })}
              >
                {t('meals.delete_dish')}
              </Button>
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                {t('actions.cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="danger"
            className="self-start"
            disabled={busy}
            onClick={() => setConfirmDelete(true)}
          >
            {t('meals.delete_dish')}
          </Button>
        )}
      </div>

      {picking && (
        <IconPicker
          value={icon}
          initialCategory="dishes"
          onSelect={(selected) => {
            setIcon(selected)
            setPicking(false)
          }}
          onClose={() => setPicking(false)}
        />
      )}
      {cropFile && (
        <AvatarCropper
          file={cropFile}
          shape="rect"
          onCancel={() => setCropFile(null)}
          onConfirm={(blob) => {
            setCropFile(null)
            image.mutate({ id: dish.id, image: blob })
          }}
        />
      )}
    </form>
  )
}
