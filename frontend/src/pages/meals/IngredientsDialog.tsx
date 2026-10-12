import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import CheckIcon from '~icons/lucide/check'
import CloseIcon from '~icons/lucide/x'

import { useAddToList, useShoppingItems, useShoppingList } from '../../api/shopping'
import { TaskIcon } from '../../components/TaskIcon'
import { Alert, Button } from '../../components/ui'
import { errorMessage } from '../../errors'
import { normalize } from '../../icons/catalog'
import { iconForItem } from '../shopping/suggest'
import { combineIngredients, isPantry } from './ingredients'

/**
 * Zutaten eines oder mehrerer Rezepte auf die Einkaufsliste: Gleiches ist zusammengefasst, die
 * Menge steht als Hinweis dabei. Angehakt ist zunächst alles außer dem, was fast jeder im Haus
 * hat (Salz, Öl …) und was schon offen auf der Liste steht. Ein Tipp hakt an oder ab.
 */
export function IngredientsDialog({
  title,
  lines,
  onClose,
}: {
  title: string
  lines: readonly string[]
  onClose: () => void
}) {
  const { t } = useTranslation()
  const list = useShoppingList()
  const items = useShoppingItems()
  const add = useAddToList()
  const dialog = useRef<HTMLDivElement>(null)
  const ingredients = useMemo(() => combineIngredients(lines), [lines])
  const open = new Set(
    (list.data?.items ?? []).filter((item) => !item.checked).map((item) => normalize(item.name)),
  )
  const onList = (name: string) => open.has(normalize(name))
  // Erst wenn die Liste da ist, steht fest, was schon drauf ist.
  const [chosen, setChosen] = useState<Set<string> | null>(null)
  const [busy, setBusy] = useState(false)
  const [added, setAdded] = useState<number | null>(null)

  useEffect(() => {
    dialog.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const selected =
    chosen ??
    new Set(
      list.data
        ? ingredients
            .filter((ingredient) => !isPantry(ingredient.name) && !onList(ingredient.name))
            .map((ingredient) => normalize(ingredient.name))
        : [],
    )

  const toggle = (name: string) => {
    const next = new Set(selected)
    const key = normalize(name)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setChosen(next)
  }

  const save = async () => {
    setBusy(true)
    let count = 0
    try {
      for (const ingredient of ingredients) {
        if (!selected.has(normalize(ingredient.name))) continue
        await add.mutateAsync({
          name: ingredient.name,
          icon: iconForItem(t, ingredient.name, items.data ?? []),
          // Steht es schon offen drauf, bleibt dessen Hinweis.
          ...(onList(ingredient.name) ? {} : { note: ingredient.note }),
        })
        count += 1
      }
      setAdded(count)
    } catch {
      // Der Fehler steht unten; was schon geklappt hat, bleibt auf der Liste.
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ingredients-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-2 sm:p-4"
    >
      <div
        ref={dialog}
        tabIndex={-1}
        className="flex max-h-full w-full max-w-3xl flex-col gap-4 overflow-hidden rounded-3xl bg-white p-4 outline-none sm:p-6"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="ingredients-title" className="text-2xl font-extrabold text-slate-800">
            {title}
          </h2>
          <Button variant="secondary" onClick={onClose} aria-label={t('meals.close')}>
            <CloseIcon className="size-7" aria-hidden="true" />
          </Button>
        </div>

        {ingredients.length === 0 ? (
          <p className="text-lg text-slate-600">{t('recipes.no_ingredients')}</p>
        ) : (
          <ul
            aria-label={t('recipes.ingredients')}
            className="grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(min(16rem,100%),1fr))] content-start gap-2 overflow-y-auto p-1"
          >
            {ingredients.map((ingredient) => {
              const checked = selected.has(normalize(ingredient.name))
              return (
                <li key={normalize(ingredient.name)}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    onClick={() => toggle(ingredient.name)}
                    disabled={busy || added !== null}
                    className={`flex w-full items-center gap-3 rounded-2xl p-2 text-left ring-2 focus-visible:outline-4 focus-visible:outline-orange-400 ${checked ? 'bg-emerald-50 ring-emerald-500' : 'bg-white ring-slate-200'}`}
                  >
                    <span
                      aria-hidden="true"
                      className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${checked ? 'bg-emerald-500 text-white' : 'ring-2 ring-slate-300'}`}
                    >
                      {checked && <CheckIcon className="size-5" strokeWidth={4} />}
                    </span>
                    <TaskIcon
                      icon={iconForItem(t, ingredient.name, items.data ?? [])}
                      className="size-10"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-lg leading-tight font-bold break-words text-slate-800">
                        {ingredient.name}
                      </span>
                      {(ingredient.note || onList(ingredient.name)) && (
                        <span className="block text-base text-slate-500">
                          {[ingredient.note, onList(ingredient.name) ? t('recipes.on_list') : '']
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {add.error ? <Alert>{errorMessage(t, add.error)}</Alert> : null}
        {added !== null && (
          <p role="status" className="text-lg font-bold text-emerald-700">
            {t('recipes.added_to_list', { count: added })}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-3">
          {added !== null ? (
            <Button onClick={onClose}>{t('shopping.done')}</Button>
          ) : (
            <Button disabled={busy || selected.size === 0} onClick={() => void save()}>
              {t('recipes.add_to_list', { count: selected.size })}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
