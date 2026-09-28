import { useTranslation } from 'react-i18next'

import type { NightStyle } from '../../api/frame'
import { clockOffset } from './night'

/** So weit (in Pixeln) wandert die Uhr je Schritt von `clockOffset`. */
const SHIFT_PX = 24

/**
 * Nachts statt Fotos: schwarz oder eine große, gedimmte Uhr. Die Hintergrundbeleuchtung bleibt an,
 * das kann ein Browser nicht abschalten (siehe README).
 */
export function NightScreen({
  style,
  now,
  timeZone,
}: {
  style: NightStyle
  now: Date
  timeZone?: string
}) {
  const { t, i18n } = useTranslation()
  if (style === 'dark') return <span data-testid="frame-night" className="absolute inset-0" />
  const language = i18n.resolvedLanguage ?? i18n.language
  const time = new Intl.DateTimeFormat(language, { hour: 'numeric', minute: '2-digit', timeZone })
  const offset = clockOffset(now)
  return (
    <span data-testid="frame-night" className="flex h-full items-center justify-center">
      <span
        className="text-[10rem] leading-none font-extrabold text-neutral-700 tabular-nums sm:text-[14rem]"
        style={{ transform: `translate(${offset.x * SHIFT_PX}px, ${offset.y * SHIFT_PX}px)` }}
      >
        <span className="sr-only">{t('home.time')}: </span>
        <time>{time.format(now)}</time>
      </span>
    </span>
  )
}
