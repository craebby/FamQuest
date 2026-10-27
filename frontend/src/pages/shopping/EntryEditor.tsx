import { type FormEvent, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import CloseIcon from '~icons/lucide/x'

import { type ListItem, useShoppingItems } from '../../api/shopping'
import { sameName } from '../../api/shoppingOps'
import { TaskIcon } from '../../components/TaskIcon'
import { Button } from '../../components/ui'
import { IconPicker } from '../parents/IconPicker'
import { AreaIcon } from './AreaIcon'
import { itemArea } from './areas'
import { iconForItem } from './suggest'

export interface EntryChange {
  name: string
  icon: string
  note: string
}

interface EntryEditorProps {
  item: ListItem
  onSave: (change: EntryChange) => void
  /** Öffnet „Wo gibt es …?“; nur für offene Artikel. */
  onMove?: () => void
  onRemove: () => void
  onClose: () => void
}

/**
 * Ein Eintrag der Liste nach einem Tippfehler: Name, Menge oder Hinweis, Symbol, Laden. Geht wie
 * das Abhaken ohne Eltern-PIN und ohne Netz; gespeichert wird über die Warteschlange.
 */
export function EntryEditor({ item, onSave, onMove, onRemove, onClose }: EntryEditorProps) {
  const { t } = useTranslation()
  const items = useShoppingItems()
  const [name, setName] = useState(item.name)
  const [note, setNote] = useState(item.note ?? '')
  // Selbst gewähltes Symbol; sonst folgt es dem Namen (wie beim Eintragen).
  const [chosenIcon, setChosenIcon] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const dialog = useRef<HTMLDivElement>(null)
  const typed = name.trim()
  const icon =
    chosenIcon ?? (sameName(typed, item.name) ? item.icon : iconForItem(t, typed, items.data ?? []))

  useEffect(() => {
    // Kein Autofokus aufs Textfeld, sonst geht am Touchscreen sofort die Tastatur auf.
    dialog.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !picking) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, picking])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (typed) onSave({ name: typed, icon, note: note.trim() })
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shopping-entry-title"
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/80 p-2 sm:p-4"
    >
      <div
        ref={dialog}
        tabIndex={-1}
        className="flex max-h-full w-full max-w-2xl flex-col gap-5 overflow-y-auto rounded-3xl bg-white p-4 outline-none sm:p-6"
      >
        <div className="flex items-center gap-3">
          <h2 id="shopping-entry-title" className="text-2xl font-extrabold text-slate-800">
            {t('shopping.edit_item', { name: item.name })}
          </h2>
          <Button
            variant="secondary"
            className="ml-auto"
            onClick={onClose}
            aria-label={t('shopping.close')}
          >
            <CloseIcon className="size-7" aria-hidden="true" />
          </Button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setPicking(true)}
              aria-label={t('shopping.change_icon')}
              title={t('shopping.change_icon')}
              className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-orange-50 ring-2 ring-orange-200 hover:bg-orange-100 focus-visible:outline-4 focus-visible:outline-orange-400"
            >
              <TaskIcon icon={icon} className="size-12" />
            </button>
            <label className="flex min-h-16 min-w-0 flex-[2] basis-56 items-center rounded-2xl border-2 border-slate-200 px-4 focus-within:border-orange-400">
              <span className="sr-only">{t('shopping.item_name')}</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={100}
                required
                className="min-w-0 flex-1 bg-transparent text-xl outline-none"
                autoComplete="off"
                enterKeyHint="done"
              />
            </label>
            <label className="flex min-h-16 min-w-0 flex-1 basis-36 items-center rounded-2xl border-2 border-slate-200 px-4 focus-within:border-orange-400">
              <span className="sr-only">{t('shopping.note')}</span>
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={t('shopping.note_placeholder')}
                maxLength={60}
                className="min-w-0 flex-1 bg-transparent text-lg outline-none"
                autoComplete="off"
                enterKeyHint="done"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={!typed}>
              {t('actions.save')}
            </Button>
            {onMove && (
              <Button variant="secondary" onClick={onMove}>
                <AreaIcon area={itemArea(item)} className="size-7" />
                {t('shopping.move_button')}
              </Button>
            )}
            <Button variant="danger" className="ml-auto" onClick={onRemove}>
              {t('shopping.remove_button')}
            </Button>
          </div>
        </form>
      </div>

      {picking && (
        <IconPicker
          value={icon}
          initialCategory="groceries"
          onSelect={(selected) => {
            setChosenIcon(selected)
            setPicking(false)
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  )
}
