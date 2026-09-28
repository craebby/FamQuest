/** Dauer der Überblendung, passend zu `animate-fade-in` in index.css. */
export const FADE_MS = 1500

/** Mischt eine Kopie der Liste (Fisher-Yates). */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * Zieht das nächste Foto aus dem gemischten Stapel. Erst wenn alle Fotos dran waren, wird neu
 * gemischt; das erste Foto der neuen Runde ist dann nie das zuletzt gezeigte. Fotos, die es nicht
 * mehr gibt, fallen heraus, neue kommen mit der nächsten Runde dazu.
 */
export function drawNext(
  bag: readonly number[],
  ids: readonly number[],
  last: number | null,
  random: () => number = Math.random,
): { id: number | undefined; bag: number[] } {
  let remaining = bag.filter((id) => ids.includes(id))
  if (remaining.length === 0) {
    remaining = shuffle(ids, random)
    if (remaining.length > 1 && remaining[0] === last) {
      ;[remaining[0], remaining[remaining.length - 1]] = [
        remaining[remaining.length - 1],
        remaining[0],
      ]
    }
  }
  const [id, ...rest] = remaining
  return { id, bag: rest }
}

/**
 * Füllt das Foto den Bildschirm aus (etwas abgeschnitten) oder wird es ganz gezeigt, mit
 * unscharfem Hintergrund? Nur bei ähnlichem Seitenverhältnis wird gefüllt, sonst fehlten z. B. bei
 * Hochformat Köpfe und Füße.
 */
export function fillsScreen(
  photo: { width: number; height: number },
  screen: { width: number; height: number },
  tolerance = 0.15,
): boolean {
  if (!photo.height || !screen.height || !screen.width) return false
  const ratio = photo.width / photo.height / (screen.width / screen.height)
  return ratio >= 1 / (1 + tolerance) && ratio <= 1 + tolerance
}
