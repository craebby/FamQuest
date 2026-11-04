import { normalize } from '../../icons/catalog'
import { autoArea } from './areas'

/** Endungen der Mehrzahl: „Zwiebel“ – „Zwiebeln“, „Tomate“ – „Tomaten“, „egg“ – „eggs“. */
const PLURAL = ['n', 'en', 'e', 's', 'es', 'er']

/** Teile, die nur die Form angeben: „Knoblauchzehen“ ist Knoblauch, „Paprikaschote“ Paprika. */
const PARTS = ['schote', 'schoten', 'zehe', 'zehen', 'knolle', 'knollen', 'stange', 'stangen']

const words = (name: string) =>
  normalize(name)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)

function sameWord(a: string, b: string) {
  if (a === b) return true
  const [short, long] = a.length < b.length ? [a, b] : [b, a]
  if (short.length < 3 || !long.startsWith(short)) return false
  const rest = long.slice(short.length)
  return PLURAL.includes(rest) || PARTS.includes(rest)
}

/**
 * Derselbe Artikel auf der Einkaufsliste, auch wenn ein Rezept ihn anders nennt: „rote Paprika“
 * und „Paprikaschoten“ sind „Paprika“, „Zwiebeln“ ist „Zwiebel“. Liegen beide in verschiedenen
 * Bereichen („gehackte Tomaten“ im Vorrat, „Tomaten“ beim Gemüse, „Spinat TK“), ist es etwas
 * anderes; zwei Namen mit mehreren Wörtern („rote“ und „gelbe Paprika“) ebenso.
 */
export function sameArticle(a: string, b: string): boolean {
  const wa = words(a)
  const wb = words(b)
  if (wa.length === 0 || wb.length === 0) return false
  if (wa.join(' ') === wb.join(' ')) return true
  const [short, long] = wa.length <= wb.length ? [wa, wb] : [wb, wa]
  if (short.length !== 1 || !sameWord(short[0], long[long.length - 1])) return false
  return autoArea(a, '') === autoArea(b, '')
}
