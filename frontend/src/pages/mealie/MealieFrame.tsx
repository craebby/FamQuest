import { useTranslation } from 'react-i18next'
import ExternalIcon from '~icons/lucide/external-link'
import CloseIcon from '~icons/lucide/x'

import { Button } from '../../components/ui'

/**
 * Mealie in FamQuest: die Seite von Mealie in einem Rahmen, darüber ein Knopf, der sie im Browser
 * öffnet (falls der Rahmen leer bleibt, z. B. weil Mealie dort die Anmeldung nicht behält).
 * Angemeldet wird man in Mealie selbst, einmal je Gerät.
 */
export function MealieFrame({
  src,
  onClose,
}: {
  src: string
  /** Als Ebene über einer Ansicht (Rezept, Küche): schließt sie wieder. */
  onClose?: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-white px-4 text-base font-bold text-slate-700 ring-2 ring-slate-200 hover:bg-slate-50 focus-visible:outline-4 focus-visible:outline-orange-400"
        >
          <ExternalIcon className="size-5" aria-hidden="true" />
          {t('mealie.open_browser')}
        </a>
        {onClose && (
          <Button variant="secondary" onClick={onClose} aria-label={t('mealie.close')}>
            <CloseIcon className="size-7" aria-hidden="true" />
          </Button>
        )}
      </div>
      <iframe
        title={t('mealie.title')}
        src={src}
        className="min-h-0 w-full flex-1 rounded-2xl border-0 bg-white shadow-sm"
        allow="clipboard-write; fullscreen; screen-wake-lock"
      />
    </div>
  )
}

/** Mealie als Ebene über der ganzen Ansicht (aus einem Rezept oder der Küchenansicht). */
export function MealieOverlay({ src, onClose }: { src: string; onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('mealie.title')}
      className="fixed inset-0 z-50 flex flex-col bg-slate-900/80 p-2 sm:p-4"
    >
      <MealieFrame src={src} onClose={onClose} />
    </div>
  )
}
