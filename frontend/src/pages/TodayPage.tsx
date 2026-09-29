import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import GearIcon from '~icons/fluent-emoji-flat/gear'

import { useLockParent, useMe } from '../api/auth'
import {
  DEFAULT_TILES,
  type Tile,
  type TileId,
  useHomeLayout,
  useSaveHomeLayout,
  visibleTiles,
} from '../api/home'
import { useToday } from '../api/today'
import { useIdleTimeout } from '../useIdleTimeout'
import { useNow } from '../useNow'
import { formatLongDate } from '../weekdays'
import { PARENT_IDLE_TIMEOUT_MS } from './ParentsPage'
import { HomeEditor, PinDialog } from './home/HomeEditor'
import { RoutineWidget } from './home/RoutineWidget'
import { ShoppingWidget } from './home/ShoppingWidget'
import { WeatherBadge } from './home/WeatherBadge'
import { WeekBoard } from './home/WeekBoard'

/**
 * Startseite „Heute“ als Wochen-Dashboard: im Kopf Datum, Wetter und Uhr; darunter die aktuelle
 * Routine der Kinder und der Einkauf; unten über die ganze Breite die nächsten sieben Tage mit
 * Terminen und Essen. Welche Bereiche sichtbar sind, legen die Eltern über das Zahnrad fest.
 */
export function TodayPage() {
  const { t, i18n } = useTranslation()
  const { data: me } = useMe()
  const today = useToday().data
  const layout = useHomeLayout()
  const now = useNow()
  const language = i18n.resolvedLanguage ?? i18n.language
  const time = new Intl.DateTimeFormat(language, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: me?.family.timezone,
  }).format(now)
  // null: normale Ansicht; 'pin': PIN-Abfrage; sonst der Entwurf im Bearbeitungsmodus.
  const [editing, setEditing] = useState<Tile[] | 'pin' | null>(null)

  const shown = visibleTiles(
    Array.isArray(editing) ? editing : (layout.data?.tiles ?? DEFAULT_TILES),
  )

  const startEditing = () => {
    if (layout.data) setEditing(layout.data.tiles)
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <h1 className="text-3xl font-extrabold text-orange-600">{me?.family.name}</h1>
        {today && (
          <p className="text-xl font-bold text-slate-600">{formatLongDate(language, today.date)}</p>
        )}
        {shown.has('weather') && <WeatherBadge />}
        <p className="ml-auto text-4xl font-extrabold text-slate-800 tabular-nums">
          <span className="sr-only">{t('home.time')}: </span>
          <time>{time}</time>
        </p>
        {editing === null && layout.data && (
          <button
            type="button"
            aria-label={t('home.customize')}
            title={t('home.customize')}
            onClick={() => (me?.parent_unlocked ? startEditing() : setEditing('pin'))}
            className="flex size-14 shrink-0 items-center justify-center rounded-2xl opacity-60 hover:bg-white/80 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-4 focus-visible:outline-orange-400"
          >
            <GearIcon className="size-8" aria-hidden="true" />
          </button>
        )}
      </header>
      {editing === 'pin' && (
        <PinDialog onUnlocked={startEditing} onCancel={() => setEditing(null)} />
      )}
      {Array.isArray(editing) && (
        <EditMode draft={editing} onChange={setEditing} onClose={() => setEditing(null)} />
      )}
      <Sections shown={shown} today={today?.date} />
    </main>
  )
}

/** Bearbeiten mit Vorschau; beim Verlassen (auch nach Leerlauf) sperrt die Seite wieder. */
function EditMode({
  draft,
  onChange,
  onClose,
}: {
  draft: Tile[]
  onChange: (tiles: Tile[]) => void
  onClose: () => void
}) {
  const save = useSaveHomeLayout()
  const lock = useLockParent()

  const close = () => {
    lock.mutate()
    onClose()
  }
  useIdleTimeout(PARENT_IDLE_TIMEOUT_MS, close)

  return (
    <>
      <HomeEditor
        tiles={draft}
        onChange={onChange}
        onSave={() => save.mutate({ tiles: draft }, { onSuccess: close })}
        onReset={() => onChange(DEFAULT_TILES)}
        onCancel={close}
        busy={save.isPending}
        error={save.error}
      />
    </>
  )
}

/** Routine und Einkauf nebeneinander (der Einkauf schmaler), darunter die Woche. */
function Sections({ shown, today }: { shown: Set<TileId>; today: string | undefined }) {
  const top = shown.has('tasks') || shown.has('shopping')
  const both = shown.has('tasks') && shown.has('shopping')
  return (
    <>
      {top && (
        <div
          className={`grid grid-cols-1 items-start gap-4 ${both ? 'lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]' : ''}`}
        >
          {shown.has('tasks') && <RoutineWidget />}
          {shown.has('shopping') && <ShoppingWidget />}
        </div>
      )}
      {today && (shown.has('events') || shown.has('meals')) && (
        <WeekBoard today={today} showEvents={shown.has('events')} showMeals={shown.has('meals')} />
      )}
    </>
  )
}
