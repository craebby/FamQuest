import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import UmbrellaIcon from '~icons/fluent-emoji-flat/umbrella-with-rain-drops'
import SunCloudIcon from '~icons/fluent-emoji-flat/sun-behind-cloud'

import { useWeather } from '../../api/weather'
import { WeatherIcon } from '../../components/WeatherIcon'
import { UMBRELLA_FROM, weatherKind } from '../../weatherKinds'

/** Ganze Grad; ohne „-0“. */
const degrees = (value: number) => Math.round(value) || 0

/**
 * Wetter klein im Kopf der Startseite: Symbol und Temperatur jetzt, heute Höchst-/Tiefstwert und
 * bei Regen ein Schirm. Ohne Ort ein kleiner Weg in den Elternbereich.
 */
export function WeatherBadge() {
  const { t } = useTranslation()
  const data = useWeather().data
  if (!data) return null

  if (!data.place || !data.current) {
    return (
      <Link
        to="/parents/connections"
        className="flex min-h-12 items-center gap-2 rounded-2xl px-3 text-base font-bold text-slate-500 hover:bg-white/80 focus-visible:outline-4 focus-visible:outline-orange-400"
      >
        <SunCloudIcon className="size-8 opacity-60 grayscale" aria-hidden="true" />
        {t('home.setup_weather_short')}
      </Link>
    )
  }

  const day = data.days[0]
  const umbrella = (day?.precipitation ?? 0) >= UMBRELLA_FROM
  const kind = t(`weather.kind.${weatherKind(data.current.code)}`)
  return (
    <section
      aria-label={t('home.weather')}
      title={`${data.place.name}: ${kind}`}
      className="flex items-center gap-3 rounded-2xl bg-white/80 px-3 py-1 shadow-sm"
    >
      <WeatherIcon
        code={data.current.code}
        night={!data.current.is_day}
        className="size-12 shrink-0"
      />
      <p className="text-3xl font-extrabold text-slate-800 tabular-nums">
        <span className="sr-only">
          {t('weather.now')}, {kind}:{' '}
        </span>
        {t('weather.degrees', { value: degrees(data.current.temperature) })}
      </p>
      {day && (
        <p className="text-lg font-bold text-slate-600 tabular-nums">
          {t('weather.max_min', { max: degrees(day.max), min: degrees(day.min) })}
        </p>
      )}
      {umbrella && day?.precipitation != null && (
        <span className="flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-base font-bold text-sky-900">
          <UmbrellaIcon className="size-6" aria-hidden="true" />
          {t('weather.rain', { percent: day.precipitation })}
        </span>
      )}
    </section>
  )
}
