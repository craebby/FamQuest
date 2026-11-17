import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import PhotoIcon from '~icons/fluent-emoji-flat/framed-picture'

import { useMe } from '../api/auth'
import { DEFAULT_FRAME_SETTINGS, useFrameSettings } from '../api/frame'
import { type Photo, usePhotos } from '../api/photos'
import { errorMessage } from '../errors'
import { useNow } from '../useNow'
import { FrameCalendar } from './frame/FrameCalendar'
import { NightScreen } from './frame/NightScreen'
import { Overlays } from './frame/Overlays'
import { inAnyWindow, isNightTime } from './frame/night'
import { FADE_MS, drawNext, fillsScreen } from './frame/slideshow'

/** Neue oder ausgeblendete Fotos kommen ohne Neuladen der Seite an. */
const PHOTOS_REFETCH_MS = 10 * 60 * 1000

/** Ein Foto oder, mit `calendar_every`, zwischendurch der Kalender. */
type Layer = { key: number; photo: Photo } | { key: number; photo: null }

/** Lädt ein Foto vor, damit die Überblendung nicht mit einem halb geladenen Bild beginnt. */
async function preload(url: string) {
  const image = new Image()
  image.src = url
  try {
    await image.decode?.()
  } catch {
    // Kaputte Datei: trotzdem zeigen, das nächste Foto kommt nach der Anzeigedauer.
  }
}

function useScreenSize() {
  const [size, setSize] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }))
  useEffect(() => {
    const update = () => setSize({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return size
}

function PhotoLayer({
  photo,
  screen,
}: {
  photo: Photo
  screen: { width: number; height: number }
}) {
  const fill = fillsScreen(photo, screen)
  return (
    <div className="animate-fade-in absolute inset-0" data-testid="frame-photo">
      {!fill && (
        // Die kleine Vorschau reicht für den unscharfen Hintergrund und schont schwache Geräte.
        <img
          src={photo.thumb_url}
          alt=""
          className="absolute inset-0 size-full scale-110 object-cover blur-2xl brightness-75"
        />
      )}
      <img
        src={photo.url}
        alt=""
        className={`absolute inset-0 size-full ${fill ? 'object-cover' : 'object-contain'}`}
      />
    </div>
  )
}

/**
 * Bilderrahmen: sichtbare Fotos in zufälliger Reihenfolge als Vollbild mit Überblendung, im
 * Nachtfenster stattdessen der Nachtbildschirm. In den Kalender-Zeitfenstern steht der Kalender
 * statt Fotos, sonst auf Wunsch nach einigen Fotos einmal zwischendurch. Ein Tipp irgendwo führt zu
 * „Heute“. Das passiert erst beim Loslassen (click), damit derselbe Tipp dort nichts auslöst.
 */
export function FramePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const photos = usePhotos({ refetchInterval: PHOTOS_REFETCH_MS })
  const visible = useMemo(() => (photos.data ?? []).filter((photo) => photo.visible), [photos.data])
  const screen = useScreenSize()
  // Bis die Einstellungen da sind (oder falls sie fehlen), gilt der Standard.
  const settings = useFrameSettings().data ?? DEFAULT_FRAME_SETTINGS
  const durationMs = settings.photo_seconds * 1000
  const timeZone = useMe().data?.family.timezone
  const now = useNow(15 * 1000)
  const night =
    settings.night_enabled && isNightTime(now, settings.night_start, settings.night_end, timeZone)
  const calendarTime = !night && inAnyWindow(now, settings.calendar_windows, timeZone)
  const every = settings.calendar_every

  // Die neueste Ebene blendet über der vorigen ein; danach bleibt nur sie übrig.
  const [layers, setLayers] = useState<Layer[]>([])
  // `shown`: Fotos seit dem letzten Kalender zwischendurch.
  const bag = useRef<{ ids: number[]; last: number | null; key: number; shown: number }>({
    ids: [],
    last: null,
    key: 0,
    shown: 0,
  })
  const everyRef = useRef(every)
  const visibleRef = useRef(visible)
  useEffect(() => {
    visibleRef.current = visible
    everyRef.current = every
  })

  const current = layers.at(-1)
  const hasPhotos = visible.length > 0
  // Nachts und im Kalender-Fenster werden keine Fotos geladen; danach geht es mit dem nächsten
  // weiter.
  const running = hasPhotos && !night && !calendarTime
  const interlude = running && current !== undefined && current.photo === null

  useEffect(() => {
    if (!running) return
    let cancelled = false
    const show = async () => {
      const key = bag.current.key + 1
      if (everyRef.current > 0 && bag.current.shown >= everyRef.current) {
        bag.current = { ...bag.current, key, shown: 0 }
        setLayers((old) => [...old.slice(-1), { key, photo: null }])
        return
      }
      const candidates = visibleRef.current
      const next = drawNext(
        bag.current.ids,
        candidates.map((photo) => photo.id),
        bag.current.last,
      )
      const photo = candidates.find((candidate) => candidate.id === next.id)
      if (!photo) return
      bag.current = { ids: next.bag, last: photo.id, key, shown: bag.current.shown + 1 }
      await preload(photo.url)
      if (!cancelled) setLayers((old) => [...old.slice(-1), { key, photo }])
    }
    // Das erste Foto sofort, danach nach der Anzeigedauer. Bei nur einem Foto bleibt es stehen.
    if (!current) {
      void show()
      return () => {
        cancelled = true
      }
    }
    const trim = window.setTimeout(() => setLayers((old) => old.slice(-1)), FADE_MS)
    const changes = visible.length > 1 || every > 0
    const timer = changes ? window.setTimeout(() => void show(), durationMs) : undefined
    return () => {
      cancelled = true
      window.clearTimeout(trim)
      window.clearTimeout(timer)
    }
  }, [current, running, visible.length, durationMs, every])

  useEffect(() => {
    const leave = () => navigate('/')
    window.addEventListener('keydown', leave)
    return () => window.removeEventListener('keydown', leave)
  }, [navigate])

  const empty = photos.isSuccess && !hasPhotos
  return (
    <>
      <button
        type="button"
        aria-label={t('frame.exit')}
        onClick={() => navigate('/')}
        className="fixed inset-0 cursor-none overflow-hidden bg-black focus:outline-none"
      >
        {night && <NightScreen style={settings.night_style} now={now} timeZone={timeZone} />}
        {running &&
          layers.map(
            (layer) =>
              layer.photo && <PhotoLayer key={layer.key} photo={layer.photo} screen={screen} />,
          )}
        {!night && !calendarTime && (empty || photos.isError) && (
          <span className="flex h-full flex-col items-center justify-center gap-6 p-6 text-center text-2xl text-slate-200">
            <PhotoIcon className="size-24" aria-hidden="true" />
            {photos.isError ? errorMessage(t, photos.error) : t('frame.empty')}
          </span>
        )}
      </button>
      {(calendarTime || interlude) && <FrameCalendar view={settings.calendar_view} />}
      {!night && !calendarTime && !interlude && <Overlays settings={settings} />}
    </>
  )
}
