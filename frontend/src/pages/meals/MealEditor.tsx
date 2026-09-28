import { type FormEvent, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import CloseIcon from '~icons/lucide/x'
import PencilIcon from '~icons/lucide/pencil'
import SearchIcon from '~icons/lucide/search'

import { type Meal, type MealEntry, useDishes, usePlanMeal } from '../../api/meals'
import { DishPicture } from '../../components/DishPicture'
import { Alert, Button } from '../../components/ui'
import { errorMessage } from '../../errors'
import { IconPicker } from '../parents/IconPicker'
import { DishEditor } from './DishEditor'
import { dishSuggestions, iconForName } from './suggest'
import { normalize } from '../../icons/catalog'

interface MealEditorProps {
  date: string
  meal: Meal
  /** Überschrift, z. B. „Abendessen, Samstag, 3. Oktober“. */
  title: string
  entry: MealEntry | undefined
  onClose: () => void
}

/**
 * Gericht für einen Tag eintragen: Vorschlag antippen oder Namen eintippen. Das Symbol kommt
 * automatisch und lässt sich per Tipp darauf ändern. Der Stift an einem eigenen Gericht öffnet
 * dessen Bearbeitung (Name, Symbol, Foto, löschen).
 */
export function MealEditor({ date, meal, title, entry, onClose }: MealEditorProps) {
  const { t } = useTranslation()
  const dishes = useDishes()
  const planMeal = usePlanMeal()
  const [name, setName] = useState(entry?.name ?? '')
  // Selbst gewähltes Symbol; sonst folgt es dem Namen.
  const [chosenIcon, setChosenIcon] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const dialog = useRef<HTMLDivElement>(null)

  const known = dishes.data ?? []
  const typed = name.trim()
  const icon =
    chosenIcon ?? (entry && typed === entry.name ? entry.icon : iconForName(t, typed, known))
  // Der Name im Feld ist der von `entry`: Vorschläge zeigen alles, nicht nur dieses Gericht.
  const query = entry && typed === entry.name ? '' : typed
  const suggestions = dishSuggestions(t, query, known)
  // Ein bekanntes Gericht zeigt beim Eintippen schon sein Foto.
  const typedDish = known.find((dish) => normalize(dish.name) === normalize(typed))
  const editing = known.find((dish) => dish.id === editingId)

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

  const save = (dish: { name: string; icon: string } | null) =>
    planMeal.mutate(
      { date, meal, dish: dish && { name: dish.name, icon: dish.icon } },
      { onSuccess: onClose },
    )

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (typed) save({ name: typed, icon })
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="meal-editor-title"
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/80 p-2 sm:p-4"
    >
      <div
        ref={dialog}
        tabIndex={-1}
        className="flex h-full max-h-[48rem] w-full max-w-4xl flex-col gap-4 overflow-hidden rounded-3xl bg-white p-4 outline-none sm:p-6"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="meal-editor-title" className="text-2xl font-extrabold text-slate-800">
            {editing ? t('meals.edit_dish', { name: editing.name }) : title}
          </h2>
          <Button variant="secondary" onClick={onClose} aria-label={t('meals.close')}>
            <CloseIcon className="size-7" aria-hidden="true" />
          </Button>
        </div>

        {editing ? (
          <DishEditor key={editing.id} dish={editing} onBack={() => setEditingId(null)} />
        ) : (
          <>
            <form onSubmit={submit} className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setPicking(true)}
                aria-label={t('meals.change_icon')}
                title={t('meals.change_icon')}
                className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-orange-50 ring-2 ring-orange-200 hover:bg-orange-100 focus-visible:outline-4 focus-visible:outline-orange-400"
              >
                <DishPicture
                  icon={icon}
                  imageUrl={chosenIcon ? null : (typedDish?.image_url ?? null)}
                  className="size-12"
                />
              </button>
              <label className="flex min-h-16 min-w-0 flex-1 basis-60 items-center gap-3 rounded-2xl border-2 border-slate-200 px-4 focus-within:border-orange-400">
                <SearchIcon className="size-6 shrink-0 text-slate-500" aria-hidden="true" />
                <span className="sr-only">{t('meals.dish_name')}</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t('meals.dish_placeholder')}
                  maxLength={100}
                  className="min-w-0 flex-1 bg-transparent text-xl outline-none"
                  autoComplete="off"
                  enterKeyHint="done"
                />
              </label>
              <Button type="submit" disabled={!typed || planMeal.isPending}>
                {t('actions.save')}
              </Button>
            </form>

            {planMeal.error ? <Alert>{errorMessage(t, planMeal.error)}</Alert> : null}

            <div className="min-h-0 flex-1 overflow-y-auto">
              {suggestions.length === 0 ? (
                <p className="p-4 text-center text-lg text-slate-600">
                  {t('meals.no_suggestions', { name: typed })}
                </p>
              ) : (
                <ul
                  aria-label={t('meals.suggestions')}
                  className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2 p-1"
                >
                  {suggestions.map((suggestion) => (
                    <li key={suggestion.name} className="relative">
                      <button
                        type="button"
                        disabled={planMeal.isPending}
                        aria-pressed={suggestion.name === entry?.name}
                        onClick={() => save(suggestion)}
                        className="flex h-full w-full flex-col items-center gap-1 rounded-2xl p-2 text-center text-base leading-tight font-bold text-slate-700 ring-2 ring-slate-100 transition-colors hover:bg-orange-50 focus-visible:outline-4 focus-visible:outline-orange-400 active:bg-orange-100 disabled:opacity-50 aria-pressed:bg-orange-100 aria-pressed:ring-4 aria-pressed:ring-orange-500"
                      >
                        <DishPicture
                          icon={suggestion.icon}
                          imageUrl={suggestion.image_url}
                          className="size-14"
                        />
                        {suggestion.name}
                      </button>
                      {suggestion.dish_id !== undefined && (
                        <button
                          type="button"
                          aria-label={t('meals.edit_dish', { name: suggestion.name })}
                          title={t('meals.edit_dish', { name: suggestion.name })}
                          onClick={() => setEditingId(suggestion.dish_id ?? null)}
                          className="absolute top-1 right-1 flex size-10 items-center justify-center rounded-full bg-white text-slate-600 shadow ring-2 ring-slate-200 hover:bg-orange-50 focus-visible:outline-4 focus-visible:outline-orange-400"
                        >
                          <PencilIcon className="size-5" aria-hidden="true" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {entry && (
              <div className="flex justify-end">
                <Button variant="danger" disabled={planMeal.isPending} onClick={() => save(null)}>
                  {t('meals.remove')}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {picking && (
        <IconPicker
          value={icon}
          initialCategory="dishes"
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
