import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import ClockIcon from '~icons/fluent-emoji-flat/mantelpiece-clock'
import StarIcon from '~icons/fluent-emoji-flat/glowing-star'
import BlackIcon from '~icons/fluent-emoji-flat/black-large-square'
import MoonIcon from '~icons/fluent-emoji-flat/crescent-moon'
import NightIcon from '~icons/fluent-emoji-flat/night-with-stars'
import CalendarIcon from '~icons/fluent-emoji-flat/spiral-calendar'
import SunCloudIcon from '~icons/fluent-emoji-flat/sun-behind-cloud'
import DayIcon from '~icons/fluent-emoji-flat/calendar'
import DaysIcon from '~icons/fluent-emoji-flat/tear-off-calendar'
import TrashIcon from '~icons/fluent-emoji-flat/wastebasket'

import {
  CALENDAR_EVERY,
  CALENDAR_VIEWS,
  type CalendarWindow,
  FRAME_SETTINGS_KEY,
  type FrameSettings,
  MAX_CALENDAR_WINDOWS,
  NIGHT_STYLES,
  PHOTO_SECONDS,
  useFrameSettings,
  useSaveFrameSettings,
} from '../../api/frame'
import { Alert, Button, Section, Switch, TextField } from '../../components/ui'
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
const CALENDAR_VIEW_ICONS = { day: DayIcon, days: DaysIcon } as const

/** Vorschläge für neue Zeitfenster: Frühstück, Abendessen, Mittag. */
const WINDOW_SUGGESTIONS: CalendarWindow[] = [
  { start: '06:30', end: '08:00' },
  { start: '17:30', end: '19:00' },
  { start: '12:00', end: '13:00' },
]

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
          <CalendarSettings data={data} change={change} />
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

/** Kalender statt Fotos: Zeitfenster, Ansicht und „zwischendurch“. */
function CalendarSettings({
  data,
  change,
}: {
  data: FrameSettings
  change: (patch: Partial<FrameSettings>) => void
}) {
  const { t } = useTranslation()
  const windows = data.calendar_windows
  // Die Zeitfelder sind ungesteuert; nach dem Entfernen bekommen alle neue Felder.
  const [generation, setGeneration] = useState(0)
  const setWindow = (index: number, window: CalendarWindow) =>
    change({ calendar_windows: windows.map((old, i) => (i === index ? window : old)) })
  const suggestion =
    WINDOW_SUGGESTIONS.find(
      (candidate) => !windows.some((window) => window.start === candidate.start),
    ) ?? WINDOW_SUGGESTIONS[0]

  return (
    <Field label={t('frame.calendar')}>
      <p className="-mt-2 text-base text-slate-500">{t('frame.calendar_hint')}</p>
      {windows.length > 0 && (
        <ul className="flex flex-col gap-3">
          {windows.map((window, index) => (
            <li key={`${generation}-${index}`} className="flex items-end gap-3">
              <div className="grid flex-1 grid-cols-2 gap-3 sm:max-w-md">
                {(['start', 'end'] as const).map((key) => (
                  <TextField
                    key={key}
                    type="time"
                    label={t(`frame.calendar_${key}`)}
                    defaultValue={window[key]}
                    onChange={(event) => {
                      const value = event.target.value
                      if (parseClockTime(value) !== null && value !== window[key])
                        setWindow(index, { ...window, [key]: value })
                    }}
                  />
                ))}
              </div>
              <button
                type="button"
                aria-label={t('frame.calendar_remove', { start: window.start, end: window.end })}
                title={t('frame.calendar_remove', { start: window.start, end: window.end })}
                onClick={() => {
                  setGeneration((value) => value + 1)
                  change({ calendar_windows: windows.filter((_, i) => i !== index) })
                }}
                className="flex size-14 shrink-0 items-center justify-center rounded-2xl ring-2 ring-red-200 hover:bg-red-50 focus-visible:outline-4 focus-visible:outline-orange-400"
              >
                <TrashIcon className="size-7" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {windows.length < MAX_CALENDAR_WINDOWS && (
        <Button
          variant="secondary"
          className="self-start"
          onClick={() => change({ calendar_windows: [...windows, suggestion] })}
        >
          <CalendarIcon className="size-7" aria-hidden="true" />
          {t('frame.calendar_add')}
        </Button>
      )}
      <p className="mt-2 text-base font-bold text-slate-700">{t('frame.calendar_every')}</p>
      <div className="grid grid-cols-3 gap-3 sm:max-w-2xl sm:grid-cols-5">
        {CALENDAR_EVERY.map((every) => (
          <ChoiceTile
            key={every}
            name="frame-calendar-every"
            checked={data.calendar_every === every}
            onChange={() => change({ calendar_every: every })}
          >
            {every === 0 ? t('frame.calendar_never') : t('frame.calendar_after', { count: every })}
          </ChoiceTile>
        ))}
      </div>
      {(windows.length > 0 || data.calendar_every > 0) && (
        <>
          <p className="mt-2 text-base font-bold text-slate-700">{t('frame.calendar_view')}</p>
          <div className="grid grid-cols-2 gap-3 sm:max-w-md">
            {CALENDAR_VIEWS.map((view) => {
              const Icon = CALENDAR_VIEW_ICONS[view]
              return (
                <ChoiceTile
                  key={view}
                  name="frame-calendar-view"
                  checked={data.calendar_view === view}
                  onChange={() => change({ calendar_view: view })}
                >
                  <Icon className="size-10" aria-hidden="true" />
                  {t(`frame.calendar_views.${view}`)}
                </ChoiceTile>
              )
            })}
          </div>
        </>
      )}
    </Field>
  )
}
