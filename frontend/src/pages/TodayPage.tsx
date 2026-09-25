import { useTranslation } from 'react-i18next'
import MealIcon from '~icons/fluent-emoji-flat/fork-and-knife-with-plate'
import CartIcon from '~icons/fluent-emoji-flat/shopping-cart'

import { useMe } from '../api/auth'
import { useToday } from '../api/today'
import { useNow } from '../useNow'
import { formatLongDate } from '../weekdays'
import { EventsWidget } from './home/EventsWidget'
import { TasksWidget } from './home/TasksWidget'
import { WeatherWidget } from './home/WeatherWidget'
import { ComingSoon } from './home/Widget'

/**
 * Startseite „Heute“: Uhr und Datum, darunter Wetter und die nächsten Termine, die Aufgaben
 * aller Personen und Platz für Essen und Einkauf. Auf dem Wanddisplay drei Spalten.
 */
export function TodayPage() {
  const { t, i18n } = useTranslation()
  const { data: me } = useMe()
  const today = useToday().data
  const now = useNow()
  const language = i18n.resolvedLanguage ?? i18n.language
  const time = new Intl.DateTimeFormat(language, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: me?.family.timezone,
  }).format(now)

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="text-3xl font-extrabold text-orange-600">{me?.family.name}</h1>
        {today && (
          <p className="text-xl font-bold text-slate-600">{formatLongDate(language, today.date)}</p>
        )}
        <p className="ml-auto text-4xl font-extrabold text-slate-800 tabular-nums">
          <span className="sr-only">{t('home.time')}: </span>
          <time>{time}</time>
        </p>
      </header>
      <div className="grid flex-1 grid-cols-1 items-start gap-4 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <WeatherWidget />
          <EventsWidget />
        </div>
        <TasksWidget />
        <div className="flex min-w-0 flex-col gap-4 md:col-span-2 md:flex-row lg:col-span-1 lg:flex-col">
          <ComingSoon title={t('home.meals')} icon={MealIcon} text={t('home.meals_hint')} />
          <ComingSoon title={t('home.shopping')} icon={CartIcon} text={t('home.shopping_hint')} />
        </div>
      </div>
    </main>
  )
}
