import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { type ShoppingItem, useDeleteItem, useUpdateItem } from '../../api/shopping'
import { TaskIcon } from '../../components/TaskIcon'
import { Alert, Button, TextField } from '../../components/ui'
import { errorMessage } from '../../errors'
import { IconPicker } from '../parents/IconPicker'

interface ItemEditorProps {
  item: ShoppingItem
  onBack: () => void
}

/** Einen Artikel der Familie ändern (Name, Symbol) oder ganz löschen. */
export function ItemEditor({ item, onBack }: ItemEditorProps) {
  const { t } = useTranslation()
  const [name, setName] = useState(item.name)
  const [icon, setIcon] = useState(item.icon)
  const [picking, setPicking] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const update = useUpdateItem()
  const remove = useDeleteItem()
  const busy = update.isPending || remove.isPending
  const error = update.error ?? remove.error

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    update.mutate({ id: item.id, name: name.trim(), icon }, { onSuccess: onBack })
  }

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-1">
      {error ? <Alert>{errorMessage(t, error)}</Alert> : null}

      <TextField
        label={t('shopping.item_name')}
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={100}
        required
      />

      <div className="flex flex-wrap items-center gap-3">
        <TaskIcon icon={icon} className="size-20" />
        <Button variant="secondary" disabled={busy} onClick={() => setPicking(true)}>
          {t('shopping.change_icon')}
        </Button>
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
              {t('shopping.delete_confirm', { name: item.name })}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => remove.mutate(item.id, { onSuccess: onBack })}
              >
                {t('shopping.delete_item')}
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
            {t('shopping.delete_item')}
          </Button>
        )}
      </div>

      {picking && (
        <IconPicker
          value={icon}
          initialCategory="groceries"
          onSelect={(selected) => {
            setIcon(selected)
            setPicking(false)
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </form>
  )
}
