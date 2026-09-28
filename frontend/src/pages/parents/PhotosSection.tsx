import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import CameraIcon from '~icons/fluent-emoji-flat/camera'
import TrashIcon from '~icons/fluent-emoji-flat/wastebasket'

import { ApiError } from '../../api/client'
import {
  PHOTOS_KEY,
  type Photo,
  deletePhoto,
  setPhotoVisible,
  uploadPhoto,
  usePhotos,
  usePhotosMutation,
} from '../../api/photos'
import { Alert, Button, Section, Switch } from '../../components/ui'
import { errorMessage } from '../../errors'

interface Failure {
  name: string
  error: unknown
}

/** Fotos für den Bilderrahmen: hochladen (mehrere auf einmal), ein- und ausblenden, löschen. */
export function PhotosSection({ onMessage }: { onMessage: (text: string | undefined) => void }) {
  const { t } = useTranslation()
  const photos = usePhotos()
  const queryClient = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [failures, setFailures] = useState<Failure[]>([])

  // Die Fotos gehen einzeln nacheinander hoch; jedes erscheint sofort in der Übersicht.
  const upload = usePhotosMutation(async (files: File[]) => {
    const failed: Failure[] = []
    setProgress({ done: 0, total: files.length })
    for (const [index, file] of files.entries()) {
      try {
        const photo = await uploadPhoto(file)
        queryClient.setQueryData<Photo[]>(PHOTOS_KEY, (old) => [photo, ...(old ?? [])])
      } catch (error) {
        // Abgemeldet oder Elternbereich gesperrt: Die übrigen Fotos scheitern genauso.
        if (error instanceof ApiError && (error.status === 401 || error.code === 'parent.locked'))
          throw error
        failed.push({ name: file.name, error })
      }
      setProgress({ done: index + 1, total: files.length })
    }
    return { uploaded: files.length - failed.length, failed }
  })

  const start = (files: File[]) => {
    if (files.length === 0) return
    onMessage(undefined)
    setFailures([])
    upload.mutate(files, {
      onSuccess: ({ uploaded, failed }) => {
        setFailures(failed)
        if (uploaded > 0) onMessage(t('photos.uploaded', { count: uploaded }))
      },
      onSettled: () => setProgress(null),
    })
  }

  const list = photos.data
  const hidden = list?.filter((photo) => !photo.visible).length ?? 0

  return (
    <Section title={t('photos.section')}>
      <p className="-mt-1 text-base text-slate-500">{t('photos.hint')}</p>
      {photos.error ? <Alert>{errorMessage(t, photos.error)}</Alert> : null}
      {upload.isError && <Alert>{errorMessage(t, upload.error)}</Alert>}
      {failures.length > 0 && (
        <div role="alert" className="flex flex-col gap-1 rounded-2xl bg-red-100 px-4 py-3">
          <p className="text-lg font-semibold text-red-800">
            {t('photos.failed', { count: failures.length })}
          </p>
          <ul className="text-base text-red-800">
            {failures.map((failure, index) => (
              <li key={index} className="break-words">
                {failure.name}: {errorMessage(t, failure.error)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        data-testid="photos-input"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          event.target.value = ''
          start(files)
        }}
      />
      <Button
        className="self-start"
        disabled={upload.isPending}
        onClick={() => fileInput.current?.click()}
      >
        <CameraIcon className="size-8" aria-hidden="true" />
        {t('photos.add')}
      </Button>
      {progress && (
        <div className="flex flex-col gap-2" role="status">
          <p className="text-lg font-semibold text-slate-700">
            {t('photos.progress', { done: progress.done, total: progress.total })}
          </p>
          <progress
            className="h-3 w-full overflow-hidden rounded-full accent-orange-500"
            value={progress.done}
            max={progress.total}
          />
        </div>
      )}

      {list?.length === 0 && <p className="text-lg text-slate-600">{t('photos.empty')}</p>}
      {list && list.length > 0 && (
        <>
          <p className="text-base text-slate-500">
            {t('photos.count', { count: list.length })}
            {hidden > 0 && ` · ${t('photos.hidden_count', { count: hidden })}`}
          </p>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {list.map((photo) => (
              <PhotoTile key={photo.id} photo={photo} onMessage={onMessage} />
            ))}
          </ul>
        </>
      )}
    </Section>
  )
}

function PhotoTile({
  photo,
  onMessage,
}: {
  photo: Photo
  onMessage: (text: string | undefined) => void
}) {
  const { t, i18n } = useTranslation()
  const toggle = usePhotosMutation(setPhotoVisible)
  const remove = usePhotosMutation(deletePhoto)
  const [confirming, setConfirming] = useState(false)
  const language = i18n.resolvedLanguage ?? i18n.language
  // Aufnahmezeit ist Ortszeit der Kamera ohne Zeitzone: so anzeigen, wie sie gespeichert ist.
  const taken = photo.taken_at
    ? new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeZone: 'UTC' }).format(
        new Date(`${photo.taken_at.slice(0, 10)}T00:00:00Z`),
      )
    : null
  const error = toggle.error ?? remove.error

  return (
    <li className="flex flex-col gap-2 rounded-2xl border-2 border-slate-200 p-2">
      <div className="relative">
        <img
          src={photo.thumb_url}
          alt={taken ? t('photos.alt_taken', { date: taken }) : t('photos.alt')}
          loading="lazy"
          className={`aspect-square w-full rounded-xl bg-slate-100 object-cover ${photo.visible ? '' : 'opacity-40 grayscale'}`}
        />
        {!photo.visible && (
          <span className="absolute top-2 left-2 rounded-full bg-slate-800/80 px-3 py-1 text-sm font-bold text-white">
            {t('photos.hidden')}
          </span>
        )}
      </div>
      {taken && <p className="px-1 text-base text-slate-500">{taken}</p>}
      {error ? (
        <p className="text-base font-semibold text-red-700">{errorMessage(t, error)}</p>
      ) : null}
      {confirming ? (
        <div className="flex flex-col gap-2 rounded-xl bg-red-50 p-2">
          <p className="text-base font-semibold text-red-800">{t('photos.delete_confirm')}</p>
          <Button
            variant="danger"
            className="px-3"
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate(photo.id, { onSuccess: () => onMessage(t('photos.deleted')) })
            }
          >
            {t('photos.delete')}
          </Button>
          <Button variant="secondary" className="px-3" onClick={() => setConfirming(false)}>
            {t('actions.cancel')}
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <Switch
            checked={photo.visible}
            disabled={toggle.isPending}
            onChange={(visible) => toggle.mutate({ id: photo.id, visible })}
            label={t('photos.show')}
            showLabel
          />
          <Button
            variant="danger"
            className="px-3"
            aria-label={t('photos.delete')}
            onClick={() => setConfirming(true)}
          >
            <TrashIcon className="size-7" aria-hidden="true" />
          </Button>
        </div>
      )}
    </li>
  )
}
