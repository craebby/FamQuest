import { type CSSProperties, useState } from 'react'
import { useTranslation } from 'react-i18next'
import GearIcon from '~icons/fluent-emoji-flat/gear'

import { useLockParent, useMe } from '../api/auth'
import {
  DEFAULT_TILES,
  type Tile,
  type TileId,
  layoutColumns,
  useHomeLayout,
  useSaveHomeLayout,
} from '../api/home'
import { useToday } from '../api/today'
import { useIdleTimeout } from '../useIdleTimeout'
import { useNow } from '../useNow'
import { formatLongDate } from '../weekdays'
import { PARENT_IDLE_TIMEOUT_MS } from './ParentsPage'
import { HomeEditor, PinDialog } from './home/HomeEditor'
import { TileView } from './home/tiles'

/**
 * Startseite „Heute“: Uhr und Datum, darunter die Kacheln in der Reihenfolge, die die Eltern
 * über das Zahnrad festlegen (für die ganze Familie). Auf dem Wanddisplay bis zu drei Spalten.
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
      {Array.isArray(editing) ? (
        <EditMode draft={editing} onChange={setEditing} onClose={() => setEditing(null)} />
      ) : (
        <Tiles tiles={visibleTiles(layout.data?.tiles ?? DEFAULT_TILES)} />
      )}
    </main>
  )
}

function visibleTiles(tiles: Tile[]): TileId[] {
  return tiles.filter((tile) => tile.visible).map((tile) => tile.id)
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
      <Tiles tiles={visibleTiles(draft)} />
    </>
  )
}

/**
 * Kacheln in Spalten: schmal untereinander, mittelgroß zwei Spalten (die dritte darunter, dort
 * nebeneinander), auf dem Wanddisplay alle Spalten nebeneinander, die Aufgaben breiter.
 */
function Tiles({ tiles }: { tiles: TileId[] }) {
  const columns = layoutColumns(tiles)
  const style = {
    '--home-columns': columns
      .map((column) => (column.wide ? 'minmax(0,1.5fr)' : 'minmax(0,1fr)'))
      .join(' '),
  } as CSSProperties

  return (
    <div
      style={style}
      className="grid flex-1 grid-cols-1 items-start gap-4 md:grid-cols-2 lg:[grid-template-columns:var(--home-columns)]"
    >
      {columns.map((column, index) => (
        <div
          key={column.tiles.join()}
          className={`flex min-w-0 flex-col gap-4 ${
            columns.length === 1 || (columns.length === 3 && index === 2)
              ? 'md:col-span-2 lg:col-span-1'
              : ''
          } ${columns.length === 3 && index === 2 ? 'md:flex-row md:*:flex-1 lg:flex-col lg:*:flex-none' : ''}`}
        >
          {column.tiles.map((id) => (
            <TileView key={id} id={id} />
          ))}
        </div>
      ))}
    </div>
  )
}
