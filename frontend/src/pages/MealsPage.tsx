import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import LeftIcon from '~icons/fluent-emoji-flat/left-arrow'
import RightIcon from '~icons/fluent-emoji-flat/right-arrow'
import PlusIcon from '~icons/lucide/plus'

import { type Meal, type MealWeek, useMealWeek } from '../api/meals'
import { TaskIcon } from '../components/TaskIcon'
import { Alert, Button } from '../components/ui'
import { errorMessage } from '../errors'
import { MealEditor } from './meals/MealEditor'
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
 * Ein Tipp auf eine Mahlzeit trägt ein Gericht ein oder ändert es, ohne Eltern-PIN.
 */
export function MealsPage() {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language
  const [offset, setOffset] = useState(0)
  const week = useMealWeek(offset)
  const data = week.data

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
            onClick={() => setOffset(offset - 1)}
            className="px-4"
          >
            <LeftIcon className="size-8" aria-hidden="true" />
          </Button>
          {offset !== 0 && (
            <Button variant="secondary" onClick={() => setOffset(0)}>
              {t('calendar.this_week')}
            </Button>
          )}
          <Button
            variant="secondary"
            aria-label={t('calendar.next_week')}
            title={t('calendar.next_week')}
            onClick={() => setOffset(offset + 1)}
            className="px-4"
          >
            <RightIcon className="size-8" aria-hidden="true" />
          </Button>
        </div>
      </header>
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
                  ? t('meals.edit_label', { meal: mealName, dish: entry.name })
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
                        <TaskIcon icon={entry.icon} className="size-14 lg:size-16" />
                        <span className="min-w-0 text-lg leading-tight font-bold break-words text-slate-800">
                          {entry.name}
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
        <MealEditor
          key={`${editing.date}-${editing.meal}`}
          date={editing.date}
          meal={editing.meal}
          title={`${t(`meals.meal.${editing.meal}`)}, ${longDate.format(parseDate(editing.date))}`}
          entry={entryOf(editing.date, editing.meal)}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}
