import type { ListItem } from '../../api/shopping'
import { iconName, normalize } from '../../icons/catalog'
import rules from './area-rules.json'

/**
 * Wo es etwas zu kaufen gibt: Bereiche im Supermarkt in der üblichen Reihenfolge des Laufwegs
 * (Obst und Gemüse am Eingang, Kühlung und Tiefkühl zum Schluss), danach die anderen Läden.
 * Die Werte stehen so auch in der API (`area`).
 */
export const SUPERMARKET_AREAS = [
  'produce',
  'bakery',
  'pantry',
  'sweets',
  'drinks',
  'household',
  'chilled',
  'frozen',
  'other',
] as const

export const STORES = ['supermarket', 'drugstore', 'hardware', 'online'] as const

export type Store = (typeof STORES)[number]
export type Area = (typeof SUPERMARKET_AREAS)[number] | Exclude<Store, 'supermarket'>

export const AREAS: readonly Area[] = [...SUPERMARKET_AREAS, 'drugstore', 'hardware', 'online']

export const storeOf = (area: Area): Store =>
  (SUPERMARKET_AREAS as readonly string[]).includes(area) ? 'supermarket' : (area as Store)

/** Was sich keinem Bereich zuordnen lässt, steht im Supermarkt unter „Sonstiges“. */
export const FALLBACK_AREA: Area = 'other'

/**
 * Stichwörter je Bereich und Symbole, die ohne passendes Stichwort den Bereich verraten (Namen im
 * Icon-Katalog). Die Regeln stehen in `area-rules.json`, damit auch der Server (Bon für den Drucker,
 * API) dieselbe Ordnung kennt. Stichwörter sind so geschrieben wie nach `normalize` (klein, ohne
 * Umlautpunkte, ß als ss). Ein Stichwort passt irgendwo im Namen; kurze (bis drei Buchstaben) nur
 * am Ende eines Wortes („Kräutertee“, aber nicht „Teelichter“).
 */
const KEYWORDS: Record<Area, readonly string[]> = rules.keywords
const ICON_AREAS: Record<string, Area> = rules.icons as Record<string, Area>

/** Symbol für Artikel ohne eigenes passendes Symbol in einem anderen Laden als dem Supermarkt. */
export const STORE_ITEM_ICONS: Partial<Record<Area, string>> = {
  drugstore: 'lotion-bottle',
  hardware: 'toolbox',
  online: 'package',
}

const KEYWORD_LIST = AREAS.flatMap((area) => KEYWORDS[area].map((word) => ({ word, area })))

// Name mit Leerzeichen davor und danach: so lässt sich das Ende eines Wortes erkennen.
const padded = (name: string) => ` ${normalize(name).replace(/[^\p{L}\p{N}-]+/gu, ' ')} `

/**
 * Bereich nach dem Namen. Gewinnt das Stichwort, das am weitesten hinten endet, bei Gleichstand das
 * längere: Im Deutschen bestimmt das letzte Wort, was es ist („Milchschokolade“ → Süßes,
 * „Orangensaft“ → Getränke, „Tiefkühlpizza“ → Tiefkühl).
 */
function areaByName(name: string): Area | undefined {
  const text = padded(name)
  let best: { area: Area; end: number; length: number } | undefined
  for (const { word, area } of KEYWORD_LIST) {
    const short = word.length <= 3
    let from = 0
    for (;;) {
      const at = text.indexOf(word, from)
      if (at === -1) break
      from = at + 1
      const end = at + word.length
      if (short && text[end] !== ' ') continue
      if (!best || end > best.end || (end === best.end && word.length > best.length))
        best = { area, end, length: word.length }
    }
  }
  return best?.area
}

/**
 * „TK-Erbsen“, „Spinat TK“, „Beeren (tiefgekühlt)“, „Tiefkühlgemüse“, „frozen peas“: Tiefkühl,
 * egal wo es im Namen steht und was sonst dabei ist.
 */
const FROZEN = / (tk[ -]|tiefkuhl|tiefgekuhlt|gefroren|frozen )/

/**
 * Automatischer Bereich eines Artikels: nach Stichwörtern im Namen, sonst nach dem Symbol, sonst
 * „Sonstiges“ im Supermarkt.
 */
export function autoArea(name: string, icon: string): Area {
  if (FROZEN.test(padded(name))) return 'frozen'
  return areaByName(name) ?? ICON_AREAS[iconName(icon) ?? ''] ?? FALLBACK_AREA
}

/** Bereich, in dem der Artikel steht: von Hand verschoben oder automatisch. */
export const itemArea = (item: Pick<ListItem, 'name' | 'icon' | 'area'>): Area =>
  item.area ?? autoArea(item.name, item.icon)

export interface AreaGroup {
  area: Area
  items: ListItem[]
}

export interface StoreGroup {
  store: Store
  areas: AreaGroup[]
}

/**
 * Artikel nach Laden und Bereich, leere weggelassen. Innerhalb eines Bereichs erst die von Hand
 * sortierten, dann die übrigen in der Reihenfolge der Liste (Zeit des Eintragens).
 */
export function groupItems(items: readonly ListItem[]): StoreGroup[] {
  const byArea = new Map<Area, ListItem[]>()
  for (const item of items) {
    const area = itemArea(item)
    byArea.set(area, [...(byArea.get(area) ?? []), item])
  }
  const rank = (item: ListItem) => item.position ?? Number.POSITIVE_INFINITY
  return STORES.map((store) => ({
    store,
    areas: AREAS.filter((area) => storeOf(area) === store && byArea.has(area)).map((area) => ({
      area,
      // sort ist stabil: Gleichstand behält die Reihenfolge der Liste.
      items: [...(byArea.get(area) ?? [])].sort((a, b) => rank(a) - rank(b)),
    })),
  })).filter((group) => group.areas.length > 0)
}
