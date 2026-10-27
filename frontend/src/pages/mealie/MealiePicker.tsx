import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import SearchIcon from '~icons/lucide/search'
import CloseIcon from '~icons/lucide/x'
import CookIcon from '~icons/fluent-emoji-flat/cook'

import { useMealieRecipes } from '../../api/mealie'
import { Alert, Button } from '../../components/ui'
import { errorMessage } from '../../errors'
import { normalize } from '../../icons/catalog'

/**
 * Welches Rezept aus Mealie gehört zu diesem Gericht? Suchen und antippen, z. B. den Djuvec-Reis
 * für „Hackbällchen mit Djuvec-Reis“.
 */
export function MealiePicker({
  dishName,
  onPick,
  onClose,
}: {
  dishName: string
  onPick: (recipeId: string) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const recipes = useMealieRecipes()
  const [query, setQuery] = useState('')
  const dialog = useRef<HTMLDivElement>(null)
  const words = normalize(query).split(/\s+/).filter(Boolean)
  const shown = (recipes.data ?? []).filter((recipe) =>
    words.every((word) => normalize(recipe.name).includes(word)),
  )

  useEffect(() => {
    // Kein Autofokus aufs Suchfeld, sonst geht am Touchscreen sofort die Tastatur auf.
    dialog.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mealie-picker-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-2 sm:p-4"
    >
      <div
        ref={dialog}
        tabIndex={-1}
        className="flex h-full max-h-[48rem] w-full max-w-3xl flex-col gap-4 overflow-hidden rounded-3xl bg-white p-4 outline-none sm:p-6"
      >
        <div className="flex items-center gap-3">
          <CookIcon className="size-12 shrink-0" aria-hidden="true" />
          <h2 id="mealie-picker-title" className="text-2xl font-extrabold text-slate-800">
            {t('mealie.pick_title', { name: dishName })}
          </h2>
          <Button
            variant="secondary"
            className="ml-auto"
            onClick={onClose}
            aria-label={t('mealie.close')}
          >
            <CloseIcon className="size-7" aria-hidden="true" />
          </Button>
        </div>
        <label className="flex min-h-14 items-center gap-3 rounded-2xl border-2 border-slate-200 px-4 focus-within:border-orange-400">
          <SearchIcon className="size-6 shrink-0 text-slate-500" aria-hidden="true" />
          <span className="sr-only">{t('mealie.search')}</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('mealie.search')}
            className="min-w-0 flex-1 bg-transparent text-xl outline-none"
            autoComplete="off"
          />
        </label>
        {recipes.error ? <Alert>{errorMessage(t, recipes.error)}</Alert> : null}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {recipes.isPending ? (
            <p role="status" className="p-4 text-lg text-slate-600">
              {t('common.loading')}
            </p>
          ) : shown.length === 0 ? (
            <p className="p-4 text-center text-lg text-slate-600">{t('mealie.pick_none')}</p>
          ) : (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(14rem,100%),1fr))] gap-2 p-1">
              {shown.map((recipe) => (
                <li key={recipe.id}>
                  <button
                    type="button"
                    onClick={() => onPick(recipe.id)}
                    className="flex h-full w-full items-center gap-3 rounded-2xl p-2 text-left ring-2 ring-slate-100 hover:bg-orange-50 focus-visible:outline-4 focus-visible:outline-orange-400"
                  >
                    {recipe.image_url ? (
                      <img
                        src={recipe.image_url}
                        alt=""
                        loading="lazy"
                        className="size-14 shrink-0 rounded-xl object-cover"
                      />
                    ) : (
                      <CookIcon className="size-14 shrink-0" aria-hidden="true" />
                    )}
                    <span className="text-lg leading-tight font-bold break-words text-slate-800">
                      {recipe.name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
