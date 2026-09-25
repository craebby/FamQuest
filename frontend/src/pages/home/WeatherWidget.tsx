import { useTranslation } from 'react-i18next'
import DropletIcon from '~icons/fluent-emoji-flat/droplet'
import SunCloudIcon from '~icons/fluent-emoji-flat/sun-behind-cloud'
import UmbrellaIcon from '~icons/fluent-emoji-flat/umbrella-with-rain-drops'

import { type WeatherDay, useWeather } from '../../api/weather'
import { WeatherIcon } from '../../components/WeatherIcon'
import { errorMessage } from '../../errors'
import { UMBRELLA_FROM, weatherKind } from '../../weatherKinds'
import { SetupHint, Widget } from './Widget'

/** Ganze Grad; ohne „-0“. */
const degrees = (value: number) => Math.round(value) || 0

function parseDate(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

/** Wetter jetzt, heute und an den nächsten zwei Tagen. */
export function WeatherWidget({ className }: { className?: string }) {
  const { t } = useTranslation()
  const weather = useWeather()
  const data = weather.data

  return (
    <Widget title={t('home.weather')} icon={SunCloudIcon} className={className}>
      {weather.isPending ? (
        <p role="status" className="text-lg text-slate-500">
          {t('common.loading')}
        </p>
      ) : !data ? (
        <p className="text-lg text-slate-600">{errorMessage(t, weather.error)}</p>
      ) : !data.place || !data.current ? (
        <SetupHint text={t('home.setup_weather')} />
      ) : (
        <>
          <div className="flex items-center gap-4">
            <WeatherIcon
              code={data.current.code}
              night={!data.current.is_day}
              className="size-24 shrink-0"
            />
            <div className="flex min-w-0 flex-col">
              <p className="text-6xl leading-none font-extrabold text-slate-800 tabular-nums">
                <span className="sr-only">{t('weather.now')}: </span>
                {t('weather.degrees', { value: degrees(data.current.temperature) })}
              </p>
              <p className="text-xl font-bold text-slate-600">
                {t(`weather.kind.${weatherKind(data.current.code)}`)}
              </p>
              <p className="truncate text-base text-slate-500">{data.place.name}</p>
            </div>
          </div>
          {data.days[0] && <TodayLine day={data.days[0]} />}
          {data.days.length > 1 && (
            <ul className="grid grid-cols-2 gap-2">
              {data.days.slice(1, 3).map((day) => (
                <NextDay key={day.date} day={day} />
              ))}
            </ul>
          )}
          {data.stale && <p className="text-base text-slate-500">{t('weather.stale')}</p>}
        </>
      )}
    </Widget>
  )
}

function TodayLine({ day }: { day: WeatherDay }) {
  const { t } = useTranslation()
  const umbrella = (day.precipitation ?? 0) >= UMBRELLA_FROM
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-lg font-bold text-slate-700">
      <span>{t('weather.max_min', { max: degrees(day.max), min: degrees(day.min) })}</span>
      {day.precipitation !== null && (
        <span
          className={`flex items-center gap-1 rounded-full px-3 py-0.5 ${umbrella ? 'bg-sky-100 text-sky-900' : ''}`}
        >
          {umbrella ? (
            <UmbrellaIcon className="size-7" aria-hidden="true" />
          ) : (
            <DropletIcon className="size-6" aria-hidden="true" />
          )}
          {t('weather.rain', { percent: day.precipitation })}
        </span>
      )}
    </p>
  )
}

function NextDay({ day }: { day: WeatherDay }) {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language
  const weekday = new Intl.DateTimeFormat(language, { weekday: 'short', timeZone: 'UTC' })
  return (
    <li className="flex items-center gap-2 rounded-2xl bg-sky-50 px-3 py-2">
      <WeatherIcon code={day.code} className="size-10 shrink-0" />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="text-base font-bold text-slate-600">
          {weekday.format(parseDate(day.date))}
          <span className="sr-only">: {t(`weather.kind.${weatherKind(day.code)}`)}</span>
        </span>
        <span className="text-lg font-extrabold text-slate-800 tabular-nums">
          {t('weather.max_min', { max: degrees(day.max), min: degrees(day.min) })}
        </span>
      </span>
    </li>
  )
}
