import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import BackIcon from '~icons/fluent-emoji-flat/left-arrow'
import BookIcon from '~icons/fluent-emoji-flat/open-book'
import PlusIcon from '~icons/lucide/plus'

import { hasRecipe, useDishes } from '../api/meals'
import { DishPicture } from '../components/DishPicture'
import { Alert, Button } from '../components/ui'
import { errorMessage } from '../errors'
import { RecipeImport } from './meals/RecipeImport'
import { RecipeView } from './meals/RecipeView'
import { StarRating } from './meals/StarRating'

/**
 * Rezeptsammlung (unter „Essen“): alle Gerichte mit Rezept, alphabetisch, mit Bild und Sternen.
 * „Rezepte einfügen“ nimmt einen Text mit einem oder mehreren Rezepten entgegen; ein Tipp auf
 * ein Rezept öffnet es zum Lesen, Bewerten und Bearbeiten. Ohne Eltern-PIN.
 */
export function RecipesPage() {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language
  const dishes = useDishes()
  const [importing, setImporting] = useState(false)
  const [open, setOpen] = useState<number | null>(null)
  const collator = new Intl.Collator(language)
  const recipes = (dishes.data ?? [])
    .filter(hasRecipe)
    .sort((a, b) => collator.compare(a.name, b.name))

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-center gap-3">
        <Link
          to="/meals"
          aria-label={t('recipes.back')}
          title={t('recipes.back')}
          className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm hover:bg-orange-50 focus-visible:outline-4 focus-visible:outline-orange-400"
        >
          <BackIcon className="size-8" aria-hidden="true" />
        </Link>
        <h1 className="text-3xl font-extrabold text-orange-600">{t('recipes.title')}</h1>
        <Button className="ml-auto" onClick={() => setImporting(true)}>
          <PlusIcon className="size-7" aria-hidden="true" />
          {t('recipes.import')}
        </Button>
      </header>

      {dishes.isPending ? (
        <p role="status" className="text-xl text-slate-600">
          {t('common.loading')}
        </p>
      ) : !dishes.data ? (
        <div className="flex flex-col items-start gap-4">
          <Alert>{errorMessage(t, dishes.error)}</Alert>
          <Button onClick={() => void dishes.refetch()}>{t('actions.retry')}</Button>
        </div>
      ) : recipes.length === 0 ? (
        <button
          type="button"
          onClick={() => setImporting(true)}
          className="flex max-w-2xl flex-col items-center gap-3 self-center rounded-3xl border-4 border-dashed border-slate-200 p-8 text-center hover:bg-white focus-visible:outline-4 focus-visible:outline-orange-400"
        >
          <BookIcon className="size-20" aria-hidden="true" />
          <span className="text-2xl font-extrabold text-slate-700">{t('recipes.empty')}</span>
          <span className="text-lg text-slate-600">{t('recipes.empty_hint')}</span>
        </button>
      ) : (
        <ul
          aria-label={t('recipes.title')}
          className="grid grid-cols-[repeat(auto-fill,minmax(min(16rem,100%),1fr))] gap-3"
        >
          {recipes.map((dish) => (
            <li key={dish.id}>
              <button
                type="button"
                onClick={() => setOpen(dish.id)}
                className="flex h-full w-full items-center gap-3 rounded-3xl bg-white p-3 text-left shadow-sm hover:bg-orange-50 focus-visible:outline-4 focus-visible:outline-orange-400"
              >
                <DishPicture icon={dish.icon} imageUrl={dish.image_url} className="size-16" />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-lg leading-tight font-bold break-words text-slate-800">
                    {dish.name}
                  </span>
                  <StarRating value={dish.rating} size="size-5" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {importing && <RecipeImport onClose={() => setImporting(false)} />}
      {open !== null && <RecipeView dishId={open} onClose={() => setOpen(null)} />}
    </main>
  )
}
