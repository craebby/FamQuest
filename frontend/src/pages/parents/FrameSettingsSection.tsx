import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import ClockIcon from '~icons/fluent-emoji-flat/mantelpiece-clock'
import StarIcon from '~icons/fluent-emoji-flat/glowing-star'
import BlackIcon from '~icons/fluent-emoji-flat/black-large-square'
import MoonIcon from '~icons/fluent-emoji-flat/crescent-moon'
import NightIcon from '~icons/fluent-emoji-flat/night-with-stars'
import CalendarIcon from '~icons/fluent-emoji-flat/spiral-calendar'
import SunCloudIcon from '~icons/fluent-emoji-flat/sun-behind-cloud'

import {
  FRAME_SETTINGS_KEY,
  type FrameSettings,
  NIGHT_STYLES,
  PHOTO_SECONDS,
  useFrameSettings,
  useSaveFrameSettings,
} from '../../api/frame'
import { Alert, Section, Switch, TextField } from '../../components/ui'
import { errorMessage } from '../../errors'
import { parseClockTime } from '../frame/night'
import { ChoiceTile, Field } from './formParts'

const OVERLAYS = [
  { key: 'show_clock', icon: ClockIcon },
  { key: 'show_weather', icon: SunCloudIcon },
  { key: 'show_event', icon: CalendarIcon },
  { key: 'show_tasks', icon: StarIcon },
] as const

const NIGHT_STYLE_ICONS = { dark: BlackIcon, clock: MoonIcon } as const

/** Einblendungen, Anzeigedauer und Nachtmodus des Bilderrahmens; jede Änderung gilt sofort. */
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
          <Field label={t('frame.night')}>
            <p className="-mt-2 text-base text-slate-500">{t('frame.night_hint')}</p>
            <div className="flex items-center gap-3">
              <NightIcon className="size-8 shrink-0" aria-hidden="true" />
              <Switch
                checked={data.night_enabled}
                onChange={(checked) => change({ night_enabled: checked })}
                label={t('frame.night_enabled')}
                showLabel
              />
            </div>
            {data.night_enabled && (
              <>
                <div className="grid grid-cols-2 gap-3 sm:max-w-md">
                  {(['night_start', 'night_end'] as const).map((key) => (
                    // Ungesteuert: Halb getippte Zeiten bleiben stehen, gespeichert wird erst eine
                    // vollständige.
                    <TextField
                      key={key}
                      type="time"
                      label={t(`frame.${key}`)}
                      defaultValue={data[key]}
                      onChange={(event) => {
                        const value = event.target.value
                        if (parseClockTime(value) !== null && value !== data[key])
                          change({ [key]: value })
                      }}
                    />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3 sm:max-w-md">
                  {NIGHT_STYLES.map((style) => {
                    const Icon = NIGHT_STYLE_ICONS[style]
                    return (
                      <ChoiceTile
                        key={style}
                        name="frame-night-style"
                        checked={data.night_style === style}
                        onChange={() => change({ night_style: style })}
                      >
                        <Icon className="size-10" aria-hidden="true" />
                        {t(`frame.night_style.${style}`)}
                      </ChoiceTile>
                    )
                  })}
                </div>
              </>
            )}
          </Field>
        </>
      )}
    </Section>
  )
}
