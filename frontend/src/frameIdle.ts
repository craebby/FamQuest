/**
 * Ob und nach wie vielen Minuten ohne Eingabe der Bilderrahmen startet. Gilt nur für dieses Gerät
 * (wie die Anzeigegröße), damit z. B. das Eltern-Handy keinen Bilderrahmen zeigt. 0 = aus.
 */
export const FRAME_IDLE_OPTIONS = [0, 1, 5, 10, 30] as const
export type FrameIdleMinutes = (typeof FRAME_IDLE_OPTIONS)[number]
export const FRAME_IDLE_STORAGE_KEY = 'famquest.frameIdleMinutes'

export function getFrameIdleMinutes(): FrameIdleMinutes {
  try {
    const stored = Number(localStorage.getItem(FRAME_IDLE_STORAGE_KEY))
    return FRAME_IDLE_OPTIONS.find((minutes) => minutes === stored) ?? 0
  } catch {
    return 0
  }
}

export function setFrameIdleMinutes(minutes: FrameIdleMinutes) {
  try {
    if (minutes === 0) localStorage.removeItem(FRAME_IDLE_STORAGE_KEY)
    else localStorage.setItem(FRAME_IDLE_STORAGE_KEY, String(minutes))
  } catch {
    // Ohne localStorage (z. B. privater Modus) startet der Bilderrahmen nur per Symbol.
  }
}
