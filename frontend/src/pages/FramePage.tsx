import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import PhotoIcon from '~icons/fluent-emoji-flat/framed-picture'

import { DEFAULT_FRAME_SETTINGS, useFrameSettings } from '../api/frame'
import { type Photo, usePhotos } from '../api/photos'
import { errorMessage } from '../errors'
import { Overlays } from './frame/Overlays'
import { FADE_MS, drawNext, fillsScreen } from './frame/slideshow'

/** Neue oder ausgeblendete Fotos kommen ohne Neuladen der Seite an. */
const PHOTOS_REFETCH_MS = 10 * 60 * 1000

interface Layer {
  key: number
  photo: Photo
}

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
 * Bilderrahmen: sichtbare Fotos in zufälliger Reihenfolge als Vollbild mit Überblendung.
 * Ein Tipp irgendwo führt zu „Heute“. Das passiert erst beim Loslassen (click), damit derselbe
 * Tipp dort nichts auslöst.
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

  // Die neueste Ebene blendet über der vorigen ein; danach bleibt nur sie übrig.
  const [layers, setLayers] = useState<Layer[]>([])
  const bag = useRef<{ ids: number[]; last: number | null; key: number }>({
    ids: [],
    last: null,
    key: 0,
  })
  const visibleRef = useRef(visible)
  useEffect(() => {
    visibleRef.current = visible
  })

  const current = layers.at(-1)
  const hasPhotos = visible.length > 0

  useEffect(() => {
    if (!hasPhotos) return
    let cancelled = false
    const show = async () => {
      const candidates = visibleRef.current
      const next = drawNext(
        bag.current.ids,
        candidates.map((photo) => photo.id),
        bag.current.last,
      )
      const photo = candidates.find((candidate) => candidate.id === next.id)
      if (!photo) return
      const key = bag.current.key + 1
      bag.current = { ids: next.bag, last: photo.id, key }
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
    const timer = visible.length > 1 ? window.setTimeout(() => void show(), durationMs) : undefined
    return () => {
      cancelled = true
      window.clearTimeout(trim)
      window.clearTimeout(timer)
    }
  }, [current, hasPhotos, visible.length, durationMs])

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
        {hasPhotos &&
          layers.map((layer) => <PhotoLayer key={layer.key} photo={layer.photo} screen={screen} />)}
        {(empty || photos.isError) && (
          <span className="flex h-full flex-col items-center justify-center gap-6 p-6 text-center text-2xl text-slate-200">
            <PhotoIcon className="size-24" aria-hidden="true" />
            {photos.isError ? errorMessage(t, photos.error) : t('frame.empty')}
          </span>
        )}
      </button>
      <Overlays settings={settings} />
    </>
  )
}
