import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import DiceIcon from '~icons/fluent-emoji-flat/game-die'
import LeftIcon from '~icons/fluent-emoji-flat/left-arrow'
import BookIcon from '~icons/fluent-emoji-flat/open-book'
import RightIcon from '~icons/fluent-emoji-flat/right-arrow'
import CartIcon from '~icons/fluent-emoji-flat/shopping-cart'
import PlusIcon from '~icons/lucide/plus'

import {
  type Meal,
  type MealWeek,
  mainMeal,
  useDishes,
  useFillMeals,
  useMealWeek,
} from '../api/meals'
import { DishPicture } from '../components/DishPicture'
import { VariantMark } from './meals/VariantMark'
import { entryLabel } from './meals/entryLabel'
import { Alert, Button } from '../components/ui'
import { errorMessage } from '../errors'
import { IngredientsDialog } from './meals/IngredientsDialog'
import { MealDialog } from './meals/MealDialog'
import { MEAL_ICONS } from './meals/mealIcons'

function parseDate(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function addDays(isoDate: string, days: number) {
  const date = parseDate(isoDate)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/**
 * Essensplan der Woche (Montag bis Sonntag): je Tag die geplanten Mahlzeiten mit großem Symbol.
 * Ein Tipp auf eine Mahlzeit trägt ein Gericht ein oder ändert es (mit Rezept zeigt er zuerst das
 * Rezept), ohne Eltern-PIN. Oben geht es zur Rezeptsammlung; „Woche füllen“ plant die leeren Tage
 * ab heute aus den Rezepten (Abendessen, sonst die letzte geplante Mahlzeit).
 */
export function MealsPage() {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language
  const [offset, setOffset] = useState(0)
  const week = useMealWeek(offset)
  const data = week.data
  const fill = useFillMeals()
  const dishes = useDishes()
  const [shopping, setShopping] = useState(false)
  // Zutaten der Rezepte, die ab heute in der gezeigten Woche geplant sind.
  const weekIngredients = data
    ? data.entries
        .filter((entry) => entry.date >= data.today)
        .flatMap(
          (entry) =>
            // Eine Variante für den Tag gilt statt des Rezepts.
            entry.variant?.ingredients ??
            dishes.data?.find((dish) => dish.id === entry.dish_id)?.ingredients ??
            [],
        )
    : []
  const [filled, setFilled] = useState<number | null>(null)
  const weekOver = data ? addDays(data.start, 6) < data.today : true

  const fillWeek = () => {
    if (!data) return
    setFilled(null)
    fill.mutate(
      { start: data.start, end: addDays(data.start, 6), meal: mainMeal(data.meals) },
      { onSuccess: (entries) => setFilled(entries.length) },
    )
  }
  const showWeek = (next: number) => {
    setOffset(next)
    setFilled(null)
    fill.reset()
  }

  const title = data
    ? new Intl.DateTimeFormat(language, {
        day: 'numeric',
        month: 'long',
        timeZone: 'UTC',
      }).formatRange(parseDate(data.start), parseDate(addDays(data.start, 6)))
    : t('meals.title')

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-extrabold text-orange-600">{title}</h1>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            aria-label={t('calendar.previous_week')}
            title={t('calendar.previous_week')}
            onClick={() => showWeek(offset - 1)}
            className="px-4"
          >
            <LeftIcon className="size-8" aria-hidden="true" />
          </Button>
          {offset !== 0 && (
            <Button variant="secondary" onClick={() => showWeek(0)}>
              {t('calendar.this_week')}
            </Button>
          )}
          <Button
            variant="secondary"
            aria-label={t('calendar.next_week')}
            title={t('calendar.next_week')}
            onClick={() => showWeek(offset + 1)}
            className="px-4"
          >
            <RightIcon className="size-8" aria-hidden="true" />
          </Button>
        </div>
        <Button
          variant="secondary"
          className="ml-auto"
          disabled={weekOver || fill.isPending}
          onClick={fillWeek}
        >
          <DiceIcon className="size-8" aria-hidden="true" />
          {t('recipes.fill')}
        </Button>
        <Button variant="secondary" disabled={weekOver} onClick={() => setShopping(true)}>
          <CartIcon className="size-8" aria-hidden="true" />
          {t('recipes.week_ingredients')}
        </Button>
        <Link
          to="/meals/recipes"
          className="inline-flex min-h-14 items-center gap-2 rounded-2xl bg-white px-4 py-2 text-lg font-bold text-slate-700 shadow-sm hover:bg-orange-50 focus-visible:outline-4 focus-visible:outline-orange-400"
        >
          <BookIcon className="size-8" aria-hidden="true" />
          {t('recipes.title')}
        </Link>
      </header>
      {fill.error ? <Alert>{errorMessage(t, fill.error)}</Alert> : null}
      {filled !== null && (
        <p role="status" className="text-lg font-bold text-emerald-700">
          {filled > 0 ? t('recipes.fill_done', { count: filled }) : t('recipes.fill_none')}
        </p>
      )}
      {week.isPending ? (
        <p role="status" className="text-xl text-slate-600">
          {t('common.loading')}
        </p>
      ) : !data ? (
        <div className="flex flex-col items-start gap-4">
          <Alert>{errorMessage(t, week.error)}</Alert>
          <Button onClick={() => void week.refetch()}>{t('actions.retry')}</Button>
        </div>
      ) : (
        <Days week={data} />
      )}
      {shopping && (
        <IngredientsDialog
          title={t('recipes.week_ingredients')}
          lines={weekIngredients}
          onClose={() => setShopping(false)}
        />
      )}
    </main>
  )
}

function Days({ week }: { week: MealWeek }) {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language
  const [editing, setEditing] = useState<{ date: string; meal: Meal } | null>(null)
  const weekday = new Intl.DateTimeFormat(language, { weekday: 'short', timeZone: 'UTC' })
  const longDate = new Intl.DateTimeFormat(language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
  const entryOf = (date: string, meal: Meal) =>
    week.entries.find((entry) => entry.date === date && entry.meal === meal)
  // Nur mit mehreren Mahlzeiten steht dabei, welche es ist.
  const labelled = week.meals.length > 1

  return (
    <>
      {/* Großer Bildschirm: sieben Spalten nebeneinander; schmal: Tage untereinander. */}
      <div className="grid flex-1 grid-cols-1 gap-3 lg:grid-cols-7">
        {Array.from({ length: 7 }, (_, index) => addDays(week.start, index)).map((day) => {
          const date = parseDate(day)
          const isToday = day === week.today
          return (
            <section
              key={day}
              aria-label={longDate.format(date)}
              aria-current={isToday ? 'date' : undefined}
              className={`flex min-w-0 flex-col gap-2 rounded-3xl p-2 ${isToday ? 'bg-orange-100 ring-4 ring-orange-400' : 'bg-white/60'}`}
            >
              <h2
                className={`flex items-baseline gap-2 rounded-2xl px-3 py-1 ${isToday ? 'bg-orange-500 text-white' : 'text-slate-700'}`}
              >
                <span className="text-lg font-bold">{weekday.format(date)}</span>
                <span className="text-3xl font-extrabold">{date.getUTCDate()}</span>
                {isToday && (
                  <span className="ml-auto text-base font-bold">{t('calendar.today')}</span>
                )}
              </h2>
              {week.meals.map((meal) => {
                const entry = entryOf(day, meal)
                const MealIcon = MEAL_ICONS[meal]
                const mealName = t(`meals.meal.${meal}`)
                const label = entry
                  ? entryLabel(t, mealName, entry)
                  : t('meals.add_label', { meal: mealName })
                return (
                  <button
                    key={meal}
                    type="button"
                    aria-label={label}
                    onClick={() => setEditing({ date: day, meal })}
                    className={`flex min-h-24 items-center gap-3 rounded-2xl p-2 text-left focus-visible:outline-4 focus-visible:outline-orange-400 lg:flex-col lg:justify-center lg:text-center ${entry ? 'bg-white shadow-sm hover:bg-orange-50' : 'border-2 border-dashed border-slate-300 text-slate-400 hover:bg-white'}`}
                  >
                    {labelled && (
                      <span className="flex shrink-0 items-center gap-1 text-sm font-bold text-slate-500 lg:self-stretch">
                        <MealIcon className="size-6" aria-hidden="true" />
                        <span className="lg:sr-only">{mealName}</span>
                      </span>
                    )}
                    {entry ? (
                      <>
                        <DishPicture
                          icon={entry.icon}
                          imageUrl={entry.image_url}
                          className="size-14 lg:size-16"
                        />
                        <span className="flex min-w-0 flex-col gap-0.5 lg:items-center">
                          <span className="text-lg leading-tight font-bold break-words text-slate-800">
                            {entry.name}
                          </span>
                          <VariantMark entry={entry} />
                        </span>
                      </>
                    ) : (
                      <PlusIcon className="size-10" aria-hidden="true" />
                    )}
                  </button>
                )
              })}
            </section>
          )
        })}
      </div>
      {editing && (
        <MealDialog
          key={`${editing.date}-${editing.meal}`}
          date={editing.date}
          meal={editing.meal}
          title={`${t(`meals.meal.${editing.meal}`)}, ${longDate.format(parseDate(editing.date))}`}
          entry={entryOf(editing.date, editing.meal)}
          upcoming={editing.date >= week.today}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}
