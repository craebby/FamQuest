import type { ListItem, ShoppingList } from './shopping'

/**
 * Änderungen an der Einkaufsliste, wie sie in der Warteschlange stehen. Ohne Netz (im Laden)
 * warten sie, bis wieder eine Verbindung da ist; bis dahin zeigt die Liste sie schon an.
 */
export interface ShoppingOpVariables {
  add: { name: string; icon: string; note?: string }
  /** `name` findet den Artikel, solange er nur offline eingetragen ist (noch ohne ID). */
  check: { id: number; name: string; checked: boolean }
  remove: { id: number; name: string }
  clear: void
}

export type ShoppingOpKind = keyof ShoppingOpVariables

export type ShoppingOp = {
  [K in ShoppingOpKind]: {
    kind: K
    variables: ShoppingOpVariables[K]
    /** Vorläufige (negative) ID für einen offline eingetragenen Artikel. */
    tempId: number
  }
}[ShoppingOpKind]

/** Gleicher Name in anderer Schreibweise ist derselbe Artikel (wie `lower()` im Server). */
export const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

function indexOf(items: readonly ListItem[], id: number, name: string) {
  const byId = items.findIndex((item) => item.id === id)
  return byId !== -1 ? byId : items.findIndex((item) => sameName(item.name, name))
}

/** Neue offene Artikel kommen ans Ende der offenen, vor die abgehakten. */
function insertOpen(items: readonly ListItem[], item: ListItem): ListItem[] {
  const firstChecked = items.findIndex((other) => other.checked)
  const at = firstChecked === -1 ? items.length : firstChecked
  return [...items.slice(0, at), item, ...items.slice(at)]
}

/** Eine Änderung so auf die Liste anwenden, wie der Server sie ausführen wird. */
export function applyOp(list: ShoppingList, op: ShoppingOp): ShoppingList {
  const items = list.items
  switch (op.kind) {
    case 'add': {
      const { name, icon, note } = op.variables
      const index = items.findIndex((item) => sameName(item.name, name))
      const existing = index === -1 ? undefined : items[index]
      if (existing && !existing.checked) {
        const updated = {
          ...existing,
          icon,
          note: note === undefined ? existing.note : note || null,
        }
        return { items: items.map((item, i) => (i === index ? updated : item)) }
      }
      const rest = existing ? items.filter((_, i) => i !== index) : items
      // Der Server behält die Schreibweise eines bekannten Artikels.
      const added = {
        id: existing?.id ?? op.tempId,
        name: existing?.name ?? name,
        icon,
        note: note || null,
        checked: false,
      }
      return { items: insertOpen(rest, added) }
    }
    case 'check': {
      const { id, name, checked } = op.variables
      const index = indexOf(items, id, name)
      return { items: items.map((item, i) => (i === index ? { ...item, checked } : item)) }
    }
    case 'remove': {
      const { id, name } = op.variables
      const index = indexOf(items, id, name)
      return { items: items.filter((_, i) => i !== index) }
    }
    case 'clear':
      return { items: items.filter((item) => !item.checked) }
  }
}

/** Die Liste vom Server mit allen noch ausstehenden Änderungen, in ihrer Reihenfolge. */
export const applyOps = (list: ShoppingList, ops: readonly ShoppingOp[]): ShoppingList =>
  ops.reduce(applyOp, list)

/** Den vom Server bestätigten Artikel übernehmen (ersetzt einen vorläufigen gleichen Namens). */
export function confirmItem(list: ShoppingList, confirmed: ListItem): ShoppingList {
  const index = indexOf(list.items, confirmed.id, confirmed.name)
  if (index === -1) return { items: insertOpen(list.items, confirmed) }
  return { items: list.items.map((item, i) => (i === index ? confirmed : item)) }
}
