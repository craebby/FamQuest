import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import CloseIcon from '~icons/lucide/x'

import { type RecipeData, hasRecipe, useDishes, useImportRecipes } from '../../api/meals'
import { DishPicture } from '../../components/DishPicture'
import { Alert, Button, TextAreaField } from '../../components/ui'
import { errorMessage } from '../../errors'
import { normalize } from '../../icons/catalog'
import { RECIPE_LIMITS, parseRecipes, withinLimits } from './parseRecipes'
import { iconForName } from './suggest'

/**
 * Rezepte einfügen: Text hineinkopieren, darunter steht sofort, was erkannt wurde (Name, Zahl der
 * Zutaten und Schritte, ob es ein Gericht schon gibt). „Speichern“ legt die Rezepte an; ein
 * vorhandenes Gericht behält Symbol, Foto und Bewertung und bekommt das neue Rezept.
 */
export function RecipeImport({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const dishes = useDishes()
  const save = useImportRecipes()
  const [text, setText] = useState('')
  const [saved, setSaved] = useState<number | null>(null)
  const dialog = useRef<HTMLDivElement>(null)
  const known = useMemo(() => dishes.data ?? [], [dishes.data])

  const recipes: RecipeData[] = useMemo(
    () =>
      parseRecipes(text)
        .slice(0, RECIPE_LIMITS.recipes)
        .map(withinLimits)
        .map((recipe) => {
          const existing = known.find((dish) => normalize(dish.name) === normalize(recipe.name))
          return { ...recipe, icon: existing?.icon ?? iconForName(t, recipe.name, known) }
        }),
    [text, known, t],
  )

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

  const existingOf = (recipe: RecipeData) =>
    known.find((dish) => normalize(dish.name) === normalize(recipe.name))

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="recipe-import-title"
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/80 p-2 sm:p-4"
    >
      <div
        ref={dialog}
        tabIndex={-1}
        className="flex h-full max-h-[56rem] w-full max-w-5xl flex-col gap-4 overflow-hidden rounded-3xl bg-white p-4 outline-none sm:p-6"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="recipe-import-title" className="text-2xl font-extrabold text-slate-800">
            {t('recipes.import_title')}
          </h2>
          <Button variant="secondary" onClick={onClose} aria-label={t('meals.close')}>
            <CloseIcon className="size-7" aria-hidden="true" />
          </Button>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-1 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <TextAreaField
              label={t('recipes.import_label')}
              value={text}
              onChange={(event) => {
                setText(event.target.value)
                setSaved(null)
              }}
              rows={14}
              placeholder={t('recipes.import_placeholder')}
            />
            <p className="text-base text-slate-500">{t('recipes.import_hint')}</p>
          </div>

          <section aria-labelledby="recipe-preview" className="flex flex-col gap-2">
            <h3 id="recipe-preview" className="text-base font-bold text-slate-700">
              {t('recipes.preview')}
            </h3>
            {recipes.length === 0 ? (
              <p className="rounded-2xl border-2 border-dashed border-slate-200 p-4 text-lg text-slate-500">
                {t('recipes.preview_empty')}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {recipes.map((recipe, index) => {
                  const existing = existingOf(recipe)
                  const badge = !existing
                    ? t('recipes.badge_new')
                    : hasRecipe(existing)
                      ? t('recipes.badge_replace')
                      : t('recipes.badge_add')
                  return (
                    <li
                      key={index}
                      className="flex items-center gap-3 rounded-2xl bg-orange-50 p-2"
                    >
                      <DishPicture
                        icon={recipe.icon}
                        imageUrl={existing?.image_url ?? null}
                        className="size-12"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-lg leading-tight font-bold break-words text-slate-800">
                          {recipe.name}
                        </p>
                        <p className="text-base text-slate-600">
                          {t('recipes.counts', {
                            ingredients: recipe.ingredients.length,
                            steps: recipe.steps.length,
                          })}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-white px-3 py-1 text-sm font-bold text-slate-600">
                        {badge}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>

        {save.error ? <Alert>{errorMessage(t, save.error)}</Alert> : null}
        {saved !== null && (
          <p role="status" className="text-lg font-bold text-emerald-700">
            {t('recipes.saved', { count: saved })}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-3">
          {saved !== null ? (
            <Button onClick={onClose}>{t('shopping.done')}</Button>
          ) : (
            <Button
              disabled={recipes.length === 0 || save.isPending}
              onClick={() =>
                save.mutate(recipes, {
                  onSuccess: (result) => {
                    setSaved(result.length)
                    setText('')
                  },
                })
              }
            >
              {t('recipes.save', { count: recipes.length })}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
