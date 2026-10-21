import { describe, expect, it } from 'vitest'

import type { ShoppingList } from './shopping'
import { type ShoppingOp, applyOps, confirmItem } from './shoppingOps'

const MILK = 'fluent-emoji-flat:glass-of-milk'
const BREAD = 'fluent-emoji-flat:bread'

const LIST: ShoppingList = {
  items: [
    { id: 1, name: 'Milch', icon: MILK, note: '2 ×', checked: false },
    { id: 2, name: 'Eier', icon: 'fluent-emoji-flat:egg', note: 'Bio', checked: true },
  ],
}

const add = (name: string, note?: string, tempId = -7): ShoppingOp => ({
  kind: 'add',
  variables: { name, icon: BREAD, note },
  tempId,
})

describe('ausstehende Änderungen', () => {
  it('setzt Neues vorläufig ans Ende der offenen, vor die abgehakten', () => {
    expect(applyOps(LIST, [add('Brot', '1 ×')]).items.map((item) => [item.id, item.name])).toEqual([
      [1, 'Milch'],
      [-7, 'Brot'],
      [2, 'Eier'],
    ])
  })

  it('holt Abgehaktes gleichen Namens zurück, ohne den alten Hinweis', () => {
    const [eggs] = applyOps(LIST, [add('eier')]).items.filter((item) => item.id === 2)
    expect(eggs).toMatchObject({ checked: false, note: null, name: 'Eier' })
  })

  it('lässt bei Offenem den Hinweis stehen, wenn keiner mitkommt', () => {
    expect(applyOps(LIST, [add('Milch')]).items[0].note).toBe('2 ×')
    expect(applyOps(LIST, [add('Milch', '')]).items[0].note).toBeNull()
  })

  it('hakt offline Eingetragenes über den Namen ab und nimmt es wieder herunter', () => {
    const checked = applyOps(LIST, [
      add('Brot'),
      { kind: 'check', variables: { id: -99, name: 'brot', checked: true }, tempId: -8 },
    ])
    expect(checked.items.find((item) => item.name === 'Brot')?.checked).toBe(true)

    const removed = applyOps(LIST, [
      add('Brot'),
      { kind: 'remove', variables: { id: -99, name: 'Brot' }, tempId: -8 },
    ])
    expect(removed.items.map((item) => item.name)).toEqual(['Milch', 'Eier'])
  })

  it('räumt Abgehaktes weg, auch was erst offline abgehakt wurde', () => {
    const list = applyOps(LIST, [
      { kind: 'check', variables: { id: 1, name: 'Milch', checked: true }, tempId: -1 },
      { kind: 'clear', variables: undefined, tempId: -2 },
    ])
    expect(list.items).toEqual([])
  })

  it('übernimmt den bestätigten Artikel an Stelle des vorläufigen', () => {
    const pending = applyOps(LIST, [add('Brot')])
    const confirmed = { id: 9, name: 'Brot', icon: BREAD, note: null, checked: false }
    expect(confirmItem(pending, confirmed).items.map((item) => item.id)).toEqual([1, 9, 2])
    expect(confirmItem(LIST, confirmed).items.map((item) => item.id)).toEqual([1, 9, 2])
  })
})
