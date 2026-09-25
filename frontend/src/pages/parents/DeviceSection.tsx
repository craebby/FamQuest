import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import LargeIcon from '~icons/fluent-emoji-flat/magnifying-glass-tilted-right'
import NormalIcon from '~icons/fluent-emoji-flat/desktop-computer'
import SmallIcon from '~icons/fluent-emoji-flat/mobile-phone'

import { Section } from '../../components/ui'
import { DISPLAY_SIZES, type DisplaySize, getDisplaySize, setDisplaySize } from '../../displaySize'
import { ChoiceTile, Field } from './formParts'

const SIZE_ICONS: Record<DisplaySize, typeof NormalIcon> = {
  small: SmallIcon,
  normal: NormalIcon,
  large: LargeIcon,
}

function readDisplay() {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    ratio: window.devicePixelRatio || 1,
    font: parseFloat(getComputedStyle(document.documentElement).fontSize) || 16,
  }
}

/** Was der Browser sieht; aktualisiert sich beim Drehen oder Ändern der Fenstergröße. */
function useDisplayInfo(size: DisplaySize) {
  const [info, setInfo] = useState(readDisplay)
  useEffect(() => {
    const update = () => setInfo(readDisplay())
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [size])
  return info
}

/** Einstellungen, die nur für dieses Gerät gelten: Anzeigegröße und Anzeige-Info. */
export function DeviceSection() {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language
  const [size, setSize] = useState<DisplaySize>(getDisplaySize)
  const info = useDisplayInfo(size)
  const number = (value: number) =>
    new Intl.NumberFormat(language, { maximumFractionDigits: 2 }).format(value)

  return (
    <Section title={t('device.section')}>
      <Field label={t('device.size')}>
        <p className="-mt-1 text-base text-slate-500">{t('device.size_hint')}</p>
        <div className="grid grid-cols-3 gap-3 sm:max-w-lg">
          {DISPLAY_SIZES.map((value) => {
            const Icon = SIZE_ICONS[value]
            return (
              <ChoiceTile
                key={value}
                name="display-size"
                checked={size === value}
                onChange={() => {
                  setDisplaySize(value)
                  setSize(value)
                }}
              >
                <Icon className="size-9" aria-hidden="true" />
                {t(`device.size_${value}`)}
              </ChoiceTile>
            )
          })}
        </div>
      </Field>
      <p className="text-base text-slate-600" data-testid="display-info">
        {t('device.info', {
          width: info.width,
          height: info.height,
          ratio: number(info.ratio),
          font: number(info.font),
        })}
      </p>
    </Section>
  )
}
