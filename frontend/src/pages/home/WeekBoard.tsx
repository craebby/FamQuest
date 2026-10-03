import { type ReactNode, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import CalendarIcon from '~icons/fluent-emoji-flat/spiral-calendar'
import WarningIcon from '~icons/fluent-emoji-flat/warning'
import ChevronDownIcon from '~icons/lucide/chevron-down'
import PlusIcon from '~icons/lucide/plus'

import {
  type CalendarWeek,
  type WeekEvent,
  useCalendarStatus,
  useCalendarWeek,
} from '../../api/calendar'
import type { WeekMode } from '../../api/home'
import { type Meal, type MealEntry, type MealWeek, useMealWeek } from '../../api/meals'
import { useMembers } from '../../api/members'
import { DishPicture } from '../../components/DishPicture'
import { useNow } from '../../useNow'
import { EventCard } from '../calendar/EventCard'
import { EventDialog } from '../calendar/EventDialog'
import { HolidayChip } from '../calendar/HolidayChip'
import { type Owners, isAllDayOnThisDay, ownersOf } from '../calendar/owners'
import { MealEditor } from '../meals/MealEditor'
import { MEAL_ICONS } from '../meals/mealIcons'

/** So viele Tage zeigt die Startseite, ab heute oder ab Montag. */
export const BOARD_DAYS = 7

function parseDate(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function addDays(isoDate: string, days: number) {
  const date = parseDate(isoDate)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

type CalendarDay = CalendarWeek['days'][number]

/** Tage zweier Wochen (diese und nächste), nach Datum. */
function byDate<T extends { date: string }>(...lists: (T[] | undefined)[]) {
  return new Map(lists.flatMap((list) => list ?? []).map((item) => [item.date, item]))
}

/** Erster Tag der Anzeige: heute (rollend) oder der Montag dieser Woche. */
function firstDay(today: string, mode: WeekMode) {
  if (mode === 'rolling') return today
  return addDays(today, -((parseDate(today).getUTCDay() + 6) % 7))
}

/**
 * Sieben Tage über die ganze Breite, ab heute oder von Montag bis Sonntag: je Tag die Termine (in
 * Personenfarbe) und unten das Essen mit Symbol und Namen. Ein Tipp aufs Essen trägt ein oder
 * ändert es. Am großen Display bleibt das Essen immer unten sichtbar; nur die Termine scrollen.
 */
export function WeekBoard({
  today,
  mode,
  showEvents,
  showMeals,
  days: dayCount = BOARD_DAYS,
  row = false,
}: {
  /** Heute in der Zeitzone der Familie (`YYYY-MM-DD`). */
  today: string
  mode: WeekMode
  showEvents: boolean
  showMeals: boolean
  /** So viele Tage; ohne Angabe eine Woche. */
  days?: number
  /**
   * Küchenansicht: die Tage stehen bei jeder Breite nebeneinander und füllen die Höhe, heute ist
   * doppelt so breit.
   */
  row?: boolean
}) {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language
  const status = useCalendarStatus()
  const calendarOn = showEvents && (status.data?.enabled ?? false)
  // Ab heute sieben Tage reichen in die nächste Woche; daher dann beide Wochen.
  const rolling = mode === 'rolling'
  const calendarWeeks = [
    useCalendarWeek(0, language, calendarOn),
    useCalendarWeek(1, language, calendarOn && rolling),
  ]
  const mealWeeks = [useMealWeek(0, showMeals), useMealWeek(1, showMeals && rolling)]
  const members = useMembers().data ?? []
  const now = useNow()
  const [openEvent, setOpenEvent] = useState<{ event: WeekEvent; owners: Owners } | null>(null)
  const [editing, setEditing] = useState<{ date: string; meal: Meal } | null>(null)

  const calendar = calendarWeeks[0].data
  const calendarDays = byDate<CalendarDay>(...calendarWeeks.map((week) => week.data?.days))
  const mealWeek: MealWeek | undefined = mealWeeks[0].data
  const meals = mealWeek?.meals ?? []
  const mealEntries = mealWeeks.flatMap((week) => week.data?.entries ?? [])
  const entryOf = (date: string, meal: Meal): MealEntry | undefined =>
    mealEntries.find((entry) => entry.date === date && entry.meal === meal)
  const start = firstDay(today, mode)
  const days = Array.from({ length: dayCount }, (_, index) => addDays(start, index))

  const weekday = new Intl.DateTimeFormat(language, { weekday: 'short', timeZone: 'UTC' })
  const longDate = new Intl.DateTimeFormat(language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })

  return (
    <section
      aria-label={t(rolling ? 'home.week_board' : 'home.week_board_monday')}
      className={`flex flex-1 flex-col gap-2 ${row ? 'min-h-0' : 'lg:min-h-96'}`}
    >
      {showEvents && status.data && !status.data.enabled && (
        <Link
          to="/parents/connections"
          className="flex items-center gap-2 self-start rounded-2xl px-3 py-1 text-base font-bold text-slate-500 hover:bg-white/80 focus-visible:outline-4 focus-visible:outline-orange-400"
        >
          <CalendarIcon className="size-7 opacity-60 grayscale" aria-hidden="true" />
          {t('home.setup_calendar_short')}
        </Link>
      )}
      {calendarOn && calendar?.problem && (
        <p className="flex items-center gap-2 self-start rounded-2xl bg-amber-100 px-3 py-1 text-base font-semibold text-amber-900">
          <WarningIcon className="size-6 shrink-0" aria-hidden="true" />
          {t('calendar.problem')}
        </p>
      )}
      {/* Großer Bildschirm: sieben Spalten nebeneinander; schmal: Tage untereinander. */}
      <div
        className={
          row
            ? 'grid min-h-0 flex-1 grid-rows-1 gap-2'
            : 'grid flex-1 grid-cols-1 gap-3 lg:min-h-0 lg:grid-cols-7 lg:grid-rows-1'
        }
        style={
          row
            ? {
                gridTemplateColumns: days
                  .map((day) => `minmax(0, ${day === today ? 2 : 1}fr)`)
                  .join(' '),
              }
            : undefined
        }
      >
        {days.map((day) => {
          const date = parseDate(day)
          const isToday = day === today
          // Nur bei Montag bis Sonntag: Tage vor heute bleiben blass sichtbar (Termine klein).
          const isPast = day < today
          const calendarDay = calendarOn ? calendarDays.get(day) : undefined
          const events = (calendarDay?.events ?? []).map((event) => ({
            event,
            owners: ownersOf(event, members),
          }))
          return (
            <section
              key={day}
              aria-label={longDate.format(date)}
              aria-current={isToday ? 'date' : undefined}
              className={`flex min-h-0 min-w-0 flex-col gap-1.5 rounded-3xl p-2 ${isToday ? 'bg-orange-100 ring-4 ring-orange-400' : 'bg-white/60'}`}
            >
              <h2
                className={`flex shrink-0 items-baseline gap-2 rounded-2xl px-3 py-0.5 ${isToday ? 'bg-orange-500 text-white' : 'text-slate-700'} ${isPast ? 'opacity-60' : ''}`}
              >
                <span className="text-lg font-bold">{weekday.format(date)}</span>
                <span className="text-2xl font-extrabold">{date.getUTCDate()}</span>
                {isToday && (
                  <span className="ml-auto text-base font-bold">{t('calendar.today')}</span>
                )}
              </h2>
              <EventScroller always={row}>
                {(calendarDay?.holidays.length ?? 0) > 0 && (
                  <ul className="flex flex-col gap-1">
                    {calendarDay?.holidays.map((holiday) => (
                      <HolidayChip key={`${holiday.kind}-${holiday.name}`} {...holiday} />
                    ))}
                  </ul>
                )}
                {events.length > 0 && calendar && (
                  <ul className="flex flex-col gap-1.5">
                    {events.map(({ event, owners }) => (
                      <EventCard
                        key={event.key}
                        event={event}
                        owners={owners}
                        familyColor={calendar.family_color}
                        timeZone={calendar.timezone}
                        past={
                          isPast ||
                          (isToday &&
                            !isAllDayOnThisDay(event) &&
                            new Date(event.end).getTime() < now.getTime())
                        }
                        onOpen={() => setOpenEvent({ event, owners })}
                      />
                    ))}
                  </ul>
                )}
              </EventScroller>
              {showMeals && mealWeek && (
                // Das Essen steht immer unten im Tag, auf einer Höhe über alle Tage.
                <div
                  className={`mt-auto flex shrink-0 flex-col gap-2 pt-1 ${isPast ? 'opacity-60' : ''}`}
                >
                  {meals.map((meal) => (
                    <MealSlot
                      key={meal}
                      meal={meal}
                      entry={entryOf(day, meal)}
                      labelled={meals.length > 1}
                      onOpen={() => setEditing({ date: day, meal })}
                    />
                  ))}
                </div>
              )}
            </section>
          )
        })}
      </div>
      {openEvent && calendar && (
        <EventDialog
          event={openEvent.event}
          owners={openEvent.owners}
          familyColor={calendar.family_color}
          timeZone={calendar.timezone}
          onClose={() => setOpenEvent(null)}
        />
      )}
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
    </section>
  )
}

/**
 * Termine eines Tages; am großen Display scrollbar, damit das Essen darunter sichtbar bleibt.
 * Gibt es unten noch mehr, blendet der Rand aus und ein Pfeil zeigt nach unten.
 */
function EventScroller({
  children,
  always = false,
}: {
  children: ReactNode
  /** Auch auf schmalen Bildschirmen scrollen (Küchenansicht), nicht erst am großen Display. */
  always?: boolean
}) {
  const { t } = useTranslation()
  const scroller = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState(false)

  useEffect(() => {
    const element = scroller.current
    if (!element) return
    const update = () =>
      setMore(element.scrollHeight - element.scrollTop - element.clientHeight > 4)
    update()
    element.addEventListener('scroll', update, { passive: true })
    // Neue Termine oder eine andere Fenstergröße ändern, ob noch etwas verborgen ist.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    observer?.observe(element)
    if (content.current) observer?.observe(content.current)
    return () => {
      element.removeEventListener('scroll', update)
      observer?.disconnect()
    }
  }, [])

  const fade = 'linear-gradient(to bottom, black calc(100% - 3rem), transparent)'
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scroller}
        className={`min-h-0 flex-1 overscroll-contain ${always ? 'overflow-y-auto' : 'lg:overflow-y-auto'}`}
        style={more ? { maskImage: fade, WebkitMaskImage: fade } : undefined}
      >
        <div ref={content} className="flex flex-col gap-1.5">
          {children}
        </div>
      </div>
      {more && (
        <span
          role="img"
          aria-label={t('home.more_events')}
          className="pointer-events-none absolute inset-x-0 bottom-0 mx-auto flex size-9 items-center justify-center rounded-full bg-white text-slate-600 shadow-md"
        >
          <ChevronDownIcon className="size-6" aria-hidden="true" />
        </span>
      )}
    </div>
  )
}

/** Eine Mahlzeit am Tagesende: Foto oder Symbol mit Namen, leer ein „+“ zum Eintragen. */
function MealSlot({
  meal,
  entry,
  labelled,
  onOpen,
}: {
  meal: Meal
  entry: MealEntry | undefined
  /** Bei mehreren Mahlzeiten steht das Symbol der Mahlzeit dabei. */
  labelled: boolean
  onOpen: () => void
}) {
  const { t } = useTranslation()
  const MealIcon = MEAL_ICONS[meal]
  const mealName = t(`meals.meal.${meal}`)
  return (
    <button
      type="button"
      aria-label={
        entry
          ? t('meals.edit_label', { meal: mealName, dish: entry.name })
          : t('meals.add_label', { meal: mealName })
      }
      onClick={onOpen}
      className={`flex min-h-16 items-center gap-2 rounded-2xl p-2 text-left focus-visible:outline-4 focus-visible:outline-orange-400 ${entry ? 'bg-white shadow-sm hover:bg-orange-50' : 'justify-center border-2 border-dashed border-slate-300 text-slate-400 hover:bg-white'}`}
    >
      {labelled && <MealIcon className="size-6 shrink-0" aria-hidden="true" />}
      {entry ? (
        <>
          <DishPicture icon={entry.icon} imageUrl={entry.image_url} className="size-12" />
          <span className="line-clamp-3 min-w-0 text-base leading-tight font-bold break-words hyphens-auto text-slate-800">
            {entry.name}
          </span>
        </>
      ) : (
        <PlusIcon className="size-7" aria-hidden="true" />
      )}
    </button>
  )
}
