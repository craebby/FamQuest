import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import PinIcon from '~icons/fluent-emoji-flat/round-pushpin'

import {
  type PlaceResult,
  usePlaceSearch,
  useRemoveWeatherPlace,
  useSetWeatherPlace,
  useWeather,
} from '../../api/weather'
import { Alert, Button, Section, TextField } from '../../components/ui'
import { errorMessage } from '../../errors'

const placeLabel = (place: PlaceResult) =>
  [place.name, place.region, place.country].filter(Boolean).join(', ')

/** Ort für das Wetter auf der Startseite: suchen, auswählen, entfernen. */
export function WeatherSection({ onSaved }: { onSaved: (message: string) => void }) {
  const { t, i18n } = useTranslation()
  const weather = useWeather()
  const place = weather.data?.place ?? null
  const [input, setInput] = useState('')
  // Gesucht wird erst beim Absenden, nicht bei jedem Tastendruck.
  const [query, setQuery] = useState('')
  const search = usePlaceSearch(query, i18n.resolvedLanguage ?? i18n.language)
  const setPlace = useSetWeatherPlace()
  const remove = useRemoveWeatherPlace()
  const error = setPlace.error ?? remove.error

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setQuery(input)
  }

  const choose = (result: PlaceResult) =>
    setPlace.mutate(
      { name: result.name, latitude: result.latitude, longitude: result.longitude },
      {
        onSuccess: () => {
          setInput('')
          setQuery('')
          onSaved(t('weather_settings.saved', { name: result.name }))
        },
      },
    )

  return (
    <Section title={t('weather_settings.section')}>
      <div className="flex flex-col gap-5">
        <p className="text-lg text-slate-600">{t('weather_settings.intro')}</p>
        {error && <Alert>{errorMessage(t, error)}</Alert>}
        <div className="flex flex-wrap items-center gap-3">
          <PinIcon className="size-8 shrink-0" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-xl font-bold text-slate-800">
            {place ? place.name : t('weather_settings.none')}
          </p>
          {place && (
            <Button
              variant="secondary"
              disabled={remove.isPending}
              onClick={() =>
                remove.mutate(undefined, {
                  onSuccess: () => onSaved(t('weather_settings.removed')),
                })
              }
            >
              {t('weather_settings.remove')}
            </Button>
          )}
        </div>
        <form className="flex flex-wrap items-end gap-3" onSubmit={submit} noValidate>
          <div className="min-w-60 flex-1">
            <TextField
              label={place ? t('weather_settings.change') : t('weather_settings.search')}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              maxLength={100}
              autoComplete="off"
            />
          </div>
          <Button type="submit" disabled={input.trim().length < 2}>
            {t('weather_settings.search_button')}
          </Button>
          <p className="w-full text-base text-slate-500">{t('weather_settings.search_hint')}</p>
        </form>
        {query.trim().length >= 2 &&
          (search.isPending ? (
            <p role="status" className="text-lg text-slate-600">
              {t('common.loading')}
            </p>
          ) : search.isError ? (
            <Alert>{errorMessage(t, search.error)}</Alert>
          ) : search.data.length === 0 ? (
            <p className="text-lg text-slate-600">{t('weather_settings.no_results')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {search.data.map((result) => (
                <li key={`${result.latitude},${result.longitude}`}>
                  <Button
                    variant="secondary"
                    className="w-full justify-start text-left"
                    disabled={setPlace.isPending}
                    onClick={() => choose(result)}
                  >
                    {placeLabel(result)}
                  </Button>
                </li>
              ))}
            </ul>
          ))}
      </div>
    </Section>
  )
}
