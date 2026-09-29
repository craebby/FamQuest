import { type FormEvent, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import CheckIcon from '~icons/fluent-emoji-flat/check-mark-button'
import CloseIcon from '~icons/lucide/x'
import PencilIcon from '~icons/lucide/pencil'
import SearchIcon from '~icons/lucide/search'

import { useAddToList, useRemoveFromList, useShoppingItems } from '../../api/shopping'
import { TaskIcon } from '../../components/TaskIcon'
import { Alert, Button } from '../../components/ui'
import { errorMessage } from '../../errors'
import { normalize } from '../../icons/catalog'
import { IconPicker } from '../parents/IconPicker'
import { ItemEditor } from './ItemEditor'
import { type ItemSuggestion, iconForItem, itemSuggestions } from './suggest'

/**
 * Was fehlt? Vorschlag antippen (nochmal antippen nimmt ihn wieder weg) oder Namen eintippen,
 * optional mit Menge oder Hinweis. Der Dialog bleibt offen, damit mehrere Artikel schnell
 * hintereinander auf die Liste kommen. Der Stift an einem eigenen Artikel öffnet dessen Bearbeitung.
 */
export function ShoppingAdder({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const items = useShoppingItems()
  const add = useAddToList()
  const remove = useRemoveFromList()
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  // Selbst gewähltes Symbol; sonst folgt es dem Namen.
  const [chosenIcon, setChosenIcon] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  // Angetippt, aber noch nicht vom Server bestätigt: so sieht man den Tipp sofort.
  const [toggled, setToggled] = useState<Record<string, boolean>>({})
  const [added, setAdded] = useState<string | null>(null)
  const dialog = useRef<HTMLDivElement>(null)

  const known = items.data ?? []
  const typed = name.trim()
  const icon = chosenIcon ?? iconForItem(t, typed, known)
  const suggestions = itemSuggestions(t, typed, known)
  const editing = known.find((item) => item.id === editingId)
  const error = add.error ?? remove.error

  useEffect(() => {
    // Kein Autofokus aufs Textfeld: Am Touchscreen würde sonst sofort die Tastatur aufgehen.
    dialog.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || picking) return
      if (editingId === null) onClose()
      else setEditingId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, picking, editingId])

  const settle = (key: string) =>
    setToggled((current) => {
      const next = { ...current }
      delete next[key]
      return next
    })

  const addItem = (item: { name: string; icon: string }) => {
    const key = normalize(item.name)
    setToggled((current) => ({ ...current, [key]: true }))
    add.mutate(
      { name: item.name, icon: item.icon, note: note.trim() || undefined },
      {
        onSuccess: (result) => setAdded(result.name),
        onSettled: () => settle(key),
      },
    )
    setName('')
    setNote('')
    setChosenIcon(null)
  }

  const toggle = (suggestion: ItemSuggestion, onList: boolean) => {
    const key = normalize(suggestion.name)
    if (key in toggled) return
    if (!onList) return addItem(suggestion)
    if (suggestion.item_id === undefined) return
    setToggled((current) => ({ ...current, [key]: false }))
    setAdded(null)
    remove.mutate(suggestion.item_id, { onSettled: () => settle(key) })
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (typed) addItem({ name: typed, icon })
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shopping-adder-title"
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/80 p-2 sm:p-4"
    >
      <div
        ref={dialog}
        tabIndex={-1}
        className="flex h-full max-h-[48rem] w-full max-w-4xl flex-col gap-4 overflow-hidden rounded-3xl bg-white p-4 outline-none sm:p-6"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="shopping-adder-title" className="text-2xl font-extrabold text-slate-800">
            {editing ? t('shopping.edit_item', { name: editing.name }) : t('shopping.add_title')}
          </h2>
          <Button variant="secondary" onClick={onClose} aria-label={t('shopping.close')}>
            <CloseIcon className="size-7" aria-hidden="true" />
          </Button>
        </div>

        {editing ? (
          <ItemEditor key={editing.id} item={editing} onBack={() => setEditingId(null)} />
        ) : (
          <>
            <form onSubmit={submit} className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setPicking(true)}
                aria-label={t('shopping.change_icon')}
                title={t('shopping.change_icon')}
                className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-orange-50 ring-2 ring-orange-200 hover:bg-orange-100 focus-visible:outline-4 focus-visible:outline-orange-400"
              >
                <TaskIcon icon={icon} className="size-12" />
              </button>
              <label className="flex min-h-16 min-w-0 flex-[2] basis-56 items-center gap-3 rounded-2xl border-2 border-slate-200 px-4 focus-within:border-orange-400">
                <SearchIcon className="size-6 shrink-0 text-slate-500" aria-hidden="true" />
                <span className="sr-only">{t('shopping.item_name')}</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t('shopping.item_placeholder')}
                  maxLength={100}
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
              <Button type="submit" disabled={!typed}>
                {t('shopping.add')}
              </Button>
            </form>

            {error ? <Alert>{errorMessage(t, error)}</Alert> : null}
            <p role="status" className="min-h-7 text-lg font-bold text-emerald-700">
              {added ? t('shopping.added', { name: added }) : ''}
            </p>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {suggestions.length === 0 ? (
                <p className="p-4 text-center text-lg text-slate-600">
                  {t('shopping.no_suggestions', { name: typed })}
                </p>
              ) : (
                <ul
                  aria-label={t('shopping.suggestions')}
                  className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2 p-1"
                >
                  {suggestions.map((suggestion) => {
                    const onList = toggled[normalize(suggestion.name)] ?? suggestion.on_list
                    return (
                      <li key={suggestion.name} className="relative">
                        <button
                          type="button"
                          aria-pressed={onList}
                          onClick={() => toggle(suggestion, onList)}
                          className="flex h-full w-full flex-col items-center gap-1 rounded-2xl p-2 text-center text-base leading-tight font-bold text-slate-700 ring-2 ring-slate-100 transition-colors hover:bg-orange-50 focus-visible:outline-4 focus-visible:outline-orange-400 active:bg-orange-100 aria-pressed:bg-emerald-50 aria-pressed:ring-4 aria-pressed:ring-emerald-500"
                        >
                          <TaskIcon icon={suggestion.icon} className="size-14" />
                          {suggestion.name}
                        </button>
                        {onList && (
                          <CheckIcon
                            className="pointer-events-none absolute top-1 left-1 size-8"
                            aria-hidden="true"
                          />
                        )}
                        {suggestion.item_id !== undefined && (
                          <button
                            type="button"
                            aria-label={t('shopping.edit_item', { name: suggestion.name })}
                            title={t('shopping.edit_item', { name: suggestion.name })}
                            onClick={() => setEditingId(suggestion.item_id ?? null)}
                            className="absolute top-1 right-1 flex size-10 items-center justify-center rounded-full bg-white text-slate-600 shadow ring-2 ring-slate-200 hover:bg-orange-50 focus-visible:outline-4 focus-visible:outline-orange-400"
                          >
                            <PencilIcon className="size-5" aria-hidden="true" />
                          </button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div className="flex justify-end">
              <Button onClick={onClose}>{t('shopping.done')}</Button>
            </div>
          </>
        )}
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
