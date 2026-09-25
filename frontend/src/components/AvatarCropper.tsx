import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Cropper, { type Area, type Point } from 'react-easy-crop'
import ZoomInIcon from '~icons/lucide/zoom-in'
import ZoomOutIcon from '~icons/lucide/zoom-out'

import { cropToBlob } from '../cropImage'
import { errorMessage } from '../errors'
import { useObjectUrl } from '../useObjectUrl'
import { Alert, Button } from './ui'

const MIN_ZOOM = 1
const MAX_ZOOM = 4

interface AvatarCropperProps {
  file: File
  onConfirm: (image: Blob) => void
  onCancel: () => void
}

/** Foto im Kreis zuschneiden: verschieben und zoomen per Touch, Maus oder Regler. */
export function AvatarCropper({ file, onConfirm, onCancel }: AvatarCropperProps) {
  const { t } = useTranslation()
  const src = useObjectUrl(file)
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(MIN_ZOOM)
  const [area, setArea] = useState<Area | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)

  const confirm = async () => {
    if (!src || !area) return
    setBusy(true)
    try {
      onConfirm(await cropToBlob(src, area))
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="avatar-cropper-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4"
    >
      <div className="flex max-h-full w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-3xl bg-white p-5 sm:p-6">
        <h2 id="avatar-cropper-title" className="text-2xl font-extrabold text-slate-800">
          {t('cropper.title')}
        </h2>
        {failed ? (
          <Alert>{errorMessage(t, 'avatar.invalid_image')}</Alert>
        ) : (
          <>
            <p className="text-lg text-slate-600">{t('cropper.hint')}</p>
            <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-slate-800">
              {src && (
                <Cropper
                  image={src}
                  crop={crop}
                  zoom={zoom}
                  minZoom={MIN_ZOOM}
                  maxZoom={MAX_ZOOM}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={(_, pixels) => setArea(pixels)}
                  mediaProps={{ onError: () => setFailed(true) }}
                />
              )}
            </div>
            <label className="flex items-center gap-3 text-slate-600">
              <ZoomOutIcon className="size-7 shrink-0" aria-hidden="true" />
              <span className="sr-only">{t('cropper.zoom')}</span>
              <input
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={0.01}
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                className="h-12 w-full accent-orange-500"
              />
              <ZoomInIcon className="size-7 shrink-0" aria-hidden="true" />
            </label>
          </>
        )}
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={onCancel}>
            {t('actions.cancel')}
          </Button>
          {!failed && (
            <Button onClick={() => void confirm()} disabled={!area || busy}>
              {t('cropper.confirm')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
