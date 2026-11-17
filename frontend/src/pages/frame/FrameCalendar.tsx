import { useTranslation } from 'react-i18next'

import { useMe } from '../../api/auth'
import type { CalendarView } from '../../api/frame'
import { useToday } from '../../api/today'
import { useNow } from '../../useNow'
import { formatLongDate } from '../../weekdays'
import { WeatherBadge } from '../home/WeatherBadge'
import { WeekBoard } from '../home/WeekBoard'
import { KITCHEN_DAYS } from '../KitchenPage'

/**
 * Kalender im Bilderrahmen statt eines Fotos: Kopf mit Datum, Wetter und Uhr, darunter heute
 * (`day`) oder heute und die nächsten Tage (`days`, wie die Küchenansicht) mit Terminen und Essen.
 * Nimmt keine Tipps an; ein Tipp beendet den Bilderrahmen wie sonst.
 */
export function FrameCalendar({ view }: { view: CalendarView }) {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language
  const timeZone = useMe().data?.family.timezone
  const today = useToday().data
  const now = useNow()
  const time = new Intl.DateTimeFormat(language, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(now)

  return (
    <div
      data-testid="frame-calendar"
      className="animate-fade-in pointer-events-none fixed inset-0 z-10 flex flex-col gap-3 bg-orange-50 p-3 sm:p-5"
    >
      <header className="flex shrink-0 items-center gap-4">
        {today && (
          <p className="min-w-0 truncate text-3xl font-extrabold text-slate-700">
            {formatLongDate(language, today.date)}
          </p>
        )}
        <WeatherBadge />
        <p className="ml-auto text-6xl font-extrabold text-slate-800 tabular-nums">
          <span className="sr-only">{t('home.time')}: </span>
          <time>{time}</time>
        </p>
      </header>
      {today && (
        <WeekBoard
          today={today.date}
          mode="rolling"
          days={view === 'day' ? 1 : KITCHEN_DAYS}
          showEvents
          showMeals
          row
          readOnly
        />
      )}
    </div>
  )
}
