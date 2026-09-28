/** Minuten seit Mitternacht für „HH:MM“; `null` bei ungültiger Eingabe. */
export function parseClockTime(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value)
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

/** Minuten seit Mitternacht in der Zeitzone der Familie (nicht der des Geräts). */
export function minutesOfDay(now: Date, timeZone?: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
    timeZone,
  }).formatToParts(now)
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0)
  return value('hour') * 60 + value('minute')
}

/**
 * Liegt `now` im Nachtfenster? Das Fenster kann über Mitternacht gehen (22:00–06:00); der Beginn
 * gehört dazu, das Ende nicht. Gleiche Zeiten ergeben ein leeres Fenster.
 */
export function isNightTime(now: Date, start: string, end: string, timeZone?: string): boolean {
  const from = parseClockTime(start)
  const to = parseClockTime(end)
  if (from === null || to === null || from === to) return false
  const minutes = minutesOfDay(now, timeZone)
  return from < to ? minutes >= from && minutes < to : minutes >= from || minutes < to
}

/** Alle so viele Minuten wandert die gedimmte Uhr ein Stück, damit sie sich nicht einbrennt. */
const SHIFT_MINUTES = 5

/** Versatz der gedimmten Uhr in Schritten: springt je Zeitabschnitt, bleibt nahe der Mitte. */
export function clockOffset(now: Date): { x: number; y: number } {
  const step = Math.floor(now.getTime() / (SHIFT_MINUTES * 60 * 1000))
  return { x: ((step * 5) % 9) - 4, y: ((step * 3) % 7) - 3 }
}
