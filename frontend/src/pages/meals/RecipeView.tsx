import { type FormEvent, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import DiceIcon from '~icons/fluent-emoji-flat/game-die'
import BookIcon from '~icons/fluent-emoji-flat/open-book'
import PencilIcon from '~icons/lucide/pencil'
import SwapIcon from '~icons/lucide/repeat'
import TrashIcon from '~icons/lucide/trash'
import CloseIcon from '~icons/lucide/x'
import MinusIcon from '~icons/lucide/minus'
import PlusIcon from '~icons/lucide/plus'
import CartIcon from '~icons/fluent-emoji-flat/shopping-cart'
import PlateIcon from '~icons/fluent-emoji-flat/fork-and-knife-with-plate'

import {
  type Dish,
  hasRecipe,
  useDeleteRecipe,
  useDishes,
  useRateDish,
  useSaveRecipe,
} from '../../api/meals'
import { DishPicture } from '../../components/DishPicture'
import { Alert, Button, TextAreaField, TextField } from '../../components/ui'
import { errorMessage } from '../../errors'
import { DishEditor } from './DishEditor'
import { IngredientsDialog } from './IngredientsDialog'
import { StarRating } from './StarRating'
import { RECIPE_LIMITS } from './parseRecipes'
import { MAX_SERVINGS, decimalOf, parseServings, scaleIngredient } from './servings'

type Mode = 'view' | 'recipe' | 'dish'

/**
 * Rezept eines Gerichts zum Mitkochen: Zutaten und Schritte groß und gut lesbar, dazu die
 * Bewertung mit Sternen. Von hier aus lassen sich Rezept, Name, Symbol und Foto ändern; aus dem
 * Essensplan heraus auch ein anderes Gericht wählen. Alles ohne Eltern-PIN.
 */
export function RecipeView({
  dishId,
  onClose,
  onChangeMeal,
  reroll,
}: {
  dishId: number
  onClose: () => void
  /** Aus dem Essensplan geöffnet: führt zum Eintragen eines anderen Gerichts. */
  onChangeMeal?: () => void
  /** Aus dem Essensplan, ab heute: ein anderes Gericht aus der Sammlung für diesen Tag. */
  reroll?: { run: () => void; busy: boolean; error: unknown }
}) {
  const { t } = useTranslation()
  const dishes = useDishes()
  const dish = dishes.data?.find((candidate) => candidate.id === dishId)
  const rate = useRateDish()
  const remove = useDeleteRecipe()
  const [mode, setMode] = useState<Mode>('view')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const dialog = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Nur beim Öffnen fokussieren, nicht bei jedem Neuzeichnen (siehe MealEditor).
    dialog.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (mode === 'view') onClose()
      else setMode('view')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, onClose])

  // Gelöscht (z. B. über „Name, Symbol, Foto“): Es gibt nichts mehr zu zeigen.
  useEffect(() => {
    if (dishes.isSuccess && !dish) onClose()
  }, [dishes.isSuccess, dish, onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="recipe-title"
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/80 p-2 sm:p-4"
    >
      <div
        ref={dialog}
        tabIndex={-1}
        className="flex h-full max-h-[56rem] w-full max-w-5xl flex-col gap-4 overflow-hidden rounded-3xl bg-white p-4 outline-none sm:p-6"
      >
        <div className="flex flex-wrap items-center gap-3">
          {dish && <DishPicture icon={dish.icon} imageUrl={dish.image_url} className="size-16" />}
          <h2
            id="recipe-title"
            className="min-w-0 flex-1 basis-48 text-3xl leading-tight font-extrabold break-words text-slate-800"
          >
            {dish?.name ?? t('common.loading')}
          </h2>
          {dish && (
            <StarRating
              value={dish.rating}
              disabled={rate.isPending}
              onChange={(rating) => rate.mutate({ id: dish.id, rating })}
            />
          )}
          <Button variant="secondary" onClick={onClose} aria-label={t('meals.close')}>
            <CloseIcon className="size-7" aria-hidden="true" />
          </Button>
        </div>
        {rate.error ? <Alert>{errorMessage(t, rate.error)}</Alert> : null}
        {reroll?.error ? <Alert>{errorMessage(t, reroll.error)}</Alert> : null}
        {remove.error ? <Alert>{errorMessage(t, remove.error)}</Alert> : null}

        {dish && mode === 'view' && (
          <>
            {/* Neu gespeicherte Portionen setzen den Umrechner zurück. */}
            <Recipe key={dish.servings} dish={dish} />
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => setMode('recipe')}>
                <PencilIcon className="size-6" aria-hidden="true" />
                {t('recipes.edit')}
              </Button>
              <Button variant="secondary" onClick={() => setMode('dish')}>
                {t('recipes.edit_dish')}
              </Button>
              {reroll && (
                <Button
                  variant="secondary"
                  className="ml-auto"
                  disabled={reroll.busy}
                  onClick={reroll.run}
                >
                  <DiceIcon className="size-7" aria-hidden="true" />
                  {t('recipes.reroll')}
                </Button>
              )}
              {onChangeMeal && (
                <Button
                  variant="secondary"
                  className={reroll ? '' : 'ml-auto'}
                  onClick={onChangeMeal}
                >
                  <SwapIcon className="size-6" aria-hidden="true" />
                  {t('recipes.change_meal')}
                </Button>
              )}
              {hasRecipe(dish) && !confirmDelete && (
                <Button
                  variant="danger"
                  className={reroll || onChangeMeal ? '' : 'ml-auto'}
                  onClick={() => setConfirmDelete(true)}
                >
                  <TrashIcon className="size-6" aria-hidden="true" />
                  {t('recipes.delete')}
                </Button>
              )}
            </div>
            {hasRecipe(dish) && confirmDelete && (
              <div className="flex flex-col gap-3 rounded-2xl bg-red-50 p-4">
                <p className="text-lg font-semibold text-red-800">
                  {t('recipes.delete_confirm', { name: dish.name })}
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="danger"
                    disabled={remove.isPending}
                    onClick={() =>
                      remove.mutate(
                        dish.id,
                        // Ohne Rezept gibt es hier nichts mehr zu sehen.
                        { onSuccess: onClose },
                      )
                    }
                  >
                    <TrashIcon className="size-6" aria-hidden="true" />
                    {t('recipes.delete')}
                  </Button>
                  <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                    {t('actions.cancel')}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
        {dish && mode === 'recipe' && <RecipeEditor dish={dish} onDone={() => setMode('view')} />}
        {dish && mode === 'dish' && <DishEditor dish={dish} onBack={() => setMode('view')} />}
      </div>
    </div>
  )
}

/**
 * Zutaten links (am Handy oben), Schritte nummeriert daneben. Stehen Portionen dabei, rechnen
 * −/+ die Mengen der Zutaten um (nur zum Anschauen und für den Einkauf, gespeichert wird nichts).
 */
function Recipe({ dish }: { dish: Dish }) {
  const { t, i18n } = useTranslation()
  const [shopping, setShopping] = useState(false)
  const [servings, setServings] = useState(dish.servings)
  const factor = dish.servings && servings ? servings / dish.servings : 1
  const decimal = decimalOf(i18n.language)
  const ingredients = dish.ingredients.map((line) => scaleIngredient(line, factor, decimal))
  if (!hasRecipe(dish)) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <BookIcon className="size-20 opacity-60" aria-hidden="true" />
        <p className="max-w-md text-xl text-slate-600">{t('recipes.no_recipe')}</p>
      </div>
    )
  }
  return (
    <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto overscroll-contain md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      {dish.ingredients.length > 0 && (
        <section aria-labelledby="recipe-ingredients" className="flex flex-col gap-2">
          <h3 id="recipe-ingredients" className="text-xl font-extrabold text-orange-600">
            {t('recipes.ingredients')}
          </h3>
          {servings !== null && (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                className="px-3"
                aria-label={t('recipes.servings_less')}
                disabled={servings <= 1}
                onClick={() => setServings(servings - 1)}
              >
                <MinusIcon className="size-7" aria-hidden="true" />
              </Button>
              <p
                aria-live="polite"
                className="flex min-w-0 flex-1 items-center justify-center gap-2 text-lg font-bold text-slate-700"
              >
                <PlateIcon className="size-8 shrink-0" aria-hidden="true" />
                {t('recipes.servings_count', { count: servings })}
              </p>
              <Button
                variant="secondary"
                className="px-3"
                aria-label={t('recipes.servings_more')}
                disabled={servings >= MAX_SERVINGS}
                onClick={() => setServings(servings + 1)}
              >
                <PlusIcon className="size-7" aria-hidden="true" />
              </Button>
            </div>
          )}
          <ul className="flex flex-col gap-1.5">
            {ingredients.map((ingredient, index) => (
              <li
                key={index}
                className="rounded-xl bg-orange-50 px-3 py-2 text-lg leading-snug font-semibold text-slate-800"
              >
                {ingredient}
              </li>
            ))}
          </ul>
          <Button variant="secondary" className="self-start" onClick={() => setShopping(true)}>
            <CartIcon className="size-7" aria-hidden="true" />
            {t('recipes.to_list')}
          </Button>
          {shopping && (
            <IngredientsDialog
              title={t('recipes.ingredients_for', { name: dish.name })}
              lines={ingredients}
              onClose={() => setShopping(false)}
            />
          )}
        </section>
      )}
      {dish.steps.length > 0 && (
        <section
          aria-labelledby="recipe-steps"
          className={`flex flex-col gap-2 ${dish.ingredients.length === 0 ? 'md:col-span-2' : ''}`}
        >
          <h3 id="recipe-steps" className="text-xl font-extrabold text-orange-600">
            {t('recipes.steps')}
          </h3>
          <ol className="flex flex-col gap-3">
            {dish.steps.map((step, index) => (
              <li key={index} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-orange-500 text-xl font-extrabold text-white"
                >
                  {index + 1}
                </span>
                <span className="pt-1 text-xl leading-snug text-slate-800">{step}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}

const lines = (text: string, max: number) =>
  text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map((line) => line.slice(0, max))
    .slice(0, RECIPE_LIMITS.lines)

/** Portionen, Zutaten und Schritte als Text, je eine Zeile; beides leer nimmt das Rezept weg. */
function RecipeEditor({ dish, onDone }: { dish: Dish; onDone: () => void }) {
  const { t } = useTranslation()
  const save = useSaveRecipe()
  const [ingredients, setIngredients] = useState(dish.ingredients.join('\n'))
  const [steps, setSteps] = useState(dish.steps.join('\n'))
  const [servings, setServings] = useState(dish.servings?.toString() ?? '')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    save.mutate(
      {
        id: dish.id,
        ingredients: lines(ingredients, RECIPE_LIMITS.ingredient),
        steps: lines(steps, RECIPE_LIMITS.step),
        servings: parseServings(servings),
      },
      { onSuccess: onDone },
    )
  }

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-1">
      {save.error ? <Alert>{errorMessage(t, save.error)}</Alert> : null}
      <div className="max-w-xs">
        <TextField
          label={t('recipes.servings_label')}
          hint={t('recipes.servings_hint')}
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_SERVINGS}
          value={servings}
          onChange={(event) => setServings(event.target.value)}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <TextAreaField
          label={t('recipes.ingredients_hint')}
          value={ingredients}
          onChange={(event) => setIngredients(event.target.value)}
          rows={10}
        />
        <TextAreaField
          label={t('recipes.steps_hint')}
          value={steps}
          onChange={(event) => setSteps(event.target.value)}
          rows={10}
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={save.isPending}>
          {t('actions.save')}
        </Button>
        <Button variant="secondary" disabled={save.isPending} onClick={onDone}>
          {t('actions.cancel')}
        </Button>
      </div>
    </form>
  )
}
