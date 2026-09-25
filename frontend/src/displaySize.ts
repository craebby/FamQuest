/**
 * Anzeigegröße je Gerät (z. B. kleiner am Tablet, größer am Wanddisplay). Sie wird nur im Browser
 * dieses Geräts gespeichert und skaliert die automatische Grundgröße (siehe index.css).
 */
export const DISPLAY_SIZES = ['small', 'normal', 'large'] as const
export type DisplaySize = (typeof DISPLAY_SIZES)[number]
export const DISPLAY_SIZE_STORAGE_KEY = 'famquest.displaySize'

export function getDisplaySize(): DisplaySize {
  try {
    const stored = localStorage.getItem(DISPLAY_SIZE_STORAGE_KEY)
    return DISPLAY_SIZES.find((size) => size === stored) ?? 'normal'
  } catch {
    return 'normal'
  }
}

/** Setzt `data-size` am <html>-Element; die Stufen stehen als --ui-scale in index.css. */
export function applyDisplaySize(size: DisplaySize = getDisplaySize()) {
  if (size === 'normal') delete document.documentElement.dataset.size
  else document.documentElement.dataset.size = size
}

export function setDisplaySize(size: DisplaySize) {
  try {
    if (size === 'normal') localStorage.removeItem(DISPLAY_SIZE_STORAGE_KEY)
    else localStorage.setItem(DISPLAY_SIZE_STORAGE_KEY, size)
  } catch {
    // Ohne localStorage (z. B. privater Modus) gilt die Größe nur bis zum Neuladen.
  }
  applyDisplaySize(size)
}
