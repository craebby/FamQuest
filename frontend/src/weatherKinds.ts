/** Wetterlagen, zu denen die WMO-Codes von Open-Meteo zusammengefasst werden. */
export const WEATHER_KINDS = [
  'clear',
  'mostly_clear',
  'partly_cloudy',
  'cloudy',
  'fog',
  'drizzle',
  'rain',
  'showers',
  'snow',
  'thunder',
] as const
export type WeatherKind = (typeof WEATHER_KINDS)[number]

/** WMO-Wettercode → Wetterlage (https://open-meteo.com/en/docs, „WMO Weather interpretation“). */
export function weatherKind(code: number): WeatherKind {
  if (code === 0) return 'clear'
  if (code === 1) return 'mostly_clear'
  if (code === 2) return 'partly_cloudy'
  if (code === 45 || code === 48) return 'fog'
  if (code >= 51 && code <= 57) return 'drizzle'
  if (code >= 61 && code <= 67) return 'rain'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow'
  if (code >= 80 && code <= 82) return 'showers'
  if (code >= 95) return 'thunder'
  return 'cloudy'
}

/** Ab dieser Regenwahrscheinlichkeit (Prozent) zeigt die Startseite einen Regenschirm. */
export const UMBRELLA_FROM = 50
