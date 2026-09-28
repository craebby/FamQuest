import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import MealIcon from '~icons/fluent-emoji-flat/fork-and-knife-with-plate'
import PlusIcon from '~icons/lucide/plus'

import { useMealWeek } from '../../api/meals'
import { DishPicture } from '../../components/DishPicture'
import { errorMessage } from '../../errors'
import { MEAL_ICONS } from '../meals/mealIcons'
import { Widget } from './Widget'

/** Was es heute zu essen gibt; ein Tipp führt zum Essensplan der Woche. */
export function MealsWidget({ className }: { className?: string }) {
  const { t } = useTranslation()
  const week = useMealWeek(0)
  const data = week.data
  const today = data?.entries.filter((entry) => entry.date === data.today) ?? []
  const labelled = (data?.meals.length ?? 0) > 1

  return (
    <Widget
      title={t('home.meals')}
      icon={MealIcon}
      more={{ to: '/meals', label: t('home.open_meals') }}
      className={className}
    >
      {week.isPending ? (
        <p role="status" className="text-lg text-slate-500">
          {t('common.loading')}
        </p>
      ) : !data ? (
        <p className="text-lg text-slate-600">{errorMessage(t, week.error)}</p>
      ) : today.length === 0 ? (
        <Link
          to="/meals"
          className="flex min-h-20 items-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 px-4 text-lg font-bold text-slate-500 hover:bg-white focus-visible:outline-4 focus-visible:outline-orange-400"
        >
          <PlusIcon className="size-8 shrink-0" aria-hidden="true" />
          {t('home.meals_empty')}
        </Link>
      ) : (
        <ul className="flex flex-col gap-2">
          {data.meals.map((meal) => {
            const entry = today.find((candidate) => candidate.meal === meal)
            if (!entry) return null
            const Icon = MEAL_ICONS[meal]
            return (
              <li key={meal} className="flex items-center gap-3">
                {labelled && (
                  <Icon
                    className="size-8 shrink-0"
                    role="img"
                    aria-label={t(`meals.meal.${meal}`)}
                  />
                )}
                <DishPicture icon={entry.icon} imageUrl={entry.image_url} className="size-16" />
                <span className="min-w-0 text-2xl font-extrabold break-words text-slate-800">
                  {entry.name}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </Widget>
  )
}
