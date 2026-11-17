import { useCallback, useState } from 'react'

/** Zähler je Gerät und Tag (z. B. gesehene Portionen, weggeräumte Häufchen); neuer Tag = 0. */
export function useDailyCounter(key: string, date: string): [number, (value: number) => void] {
  const read = () => {
    try {
      const [day, value] = (window.localStorage.getItem(key) ?? '').split(':')
      return day === date ? Number(value) || 0 : 0
    } catch {
      return 0
    }
  }
  const [state, setState] = useState({ key, date, value: read() })
  // Anderes Kind oder neuer Tag: neu lesen.
  const value = state.key === key && state.date === date ? state.value : read()
  if (state.key !== key || state.date !== date) setState({ key, date, value })
  const set = useCallback(
    (next: number) => {
      setState({ key, date, value: next })
      try {
        window.localStorage.setItem(key, `${date}:${next}`)
      } catch {
        // Ohne Speicher zählt es eben nur bis zum Neuladen.
      }
    },
    [key, date],
  )
  return [value, set]
}
