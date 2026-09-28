import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import ClockIcon from '~icons/fluent-emoji-flat/mantelpiece-clock'
import StarIcon from '~icons/fluent-emoji-flat/glowing-star'
import CalendarIcon from '~icons/fluent-emoji-flat/spiral-calendar'
import SunCloudIcon from '~icons/fluent-emoji-flat/sun-behind-cloud'

import {
  FRAME_SETTINGS_KEY,
  type FrameSettings,
  PHOTO_SECONDS,
  useFrameSettings,
  useSaveFrameSettings,
} from '../../api/frame'
import { Alert, Section, Switch } from '../../components/ui'
import { errorMessage } from '../../errors'
import { ChoiceTile, Field } from './formParts'

const OVERLAYS = [
  { key: 'show_clock', icon: ClockIcon },
  { key: 'show_weather', icon: SunCloudIcon },
  { key: 'show_event', icon: CalendarIcon },
  { key: 'show_tasks', icon: StarIcon },
] as const

/** Einblendungen und Anzeigedauer des Bilderrahmens; jede Änderung gilt sofort. */
export function FrameSettingsSection() {
  const { t } = useTranslation()
  const settings = useFrameSettings()
  const save = useSaveFrameSettings()
  const queryClient = useQueryClient()
  const data = settings.data

  const change = (patch: Partial<FrameSettings>) => {
    if (!data) return
    const next = { ...data, ...patch }
    // Sofort anzeigen; die Antwort des Servers überschreibt es danach.
    queryClient.setQueryData(FRAME_SETTINGS_KEY, next)
    save.mutate(next)
  }

  return (
    <Section title={t('frame.settings')}>
      <p className="-mt-1 text-base text-slate-500">{t('frame.settings_hint')}</p>
      {settings.error ? <Alert>{errorMessage(t, settings.error)}</Alert> : null}
      {save.error ? <Alert>{errorMessage(t, save.error)}</Alert> : null}
      {data && (
        <>
          <Field label={t('frame.overlays')}>
            <ul className="grid gap-2 sm:grid-cols-2">
              {OVERLAYS.map(({ key, icon: Icon }) => (
                <li key={key} className="flex items-center gap-3">
                  <Icon className="size-8 shrink-0" aria-hidden="true" />
                  <Switch
                    checked={data[key]}
                    onChange={(checked) => change({ [key]: checked })}
                    label={t(`frame.${key}`)}
                    showLabel
                  />
                </li>
              ))}
            </ul>
          </Field>
          <Field label={t('frame.duration')}>
            <div className="grid grid-cols-3 gap-3 sm:max-w-2xl sm:grid-cols-5">
              {PHOTO_SECONDS.map((seconds) => (
                <ChoiceTile
                  key={seconds}
                  name="frame-duration"
                  checked={data.photo_seconds === seconds}
                  onChange={() => change({ photo_seconds: seconds })}
                >
                  {seconds < 60
                    ? t('frame.seconds', { count: seconds })
                    : t('frame.minutes', { count: seconds / 60 })}
                </ChoiceTile>
              ))}
            </div>
          </Field>
        </>
      )}
    </Section>
  )
}
