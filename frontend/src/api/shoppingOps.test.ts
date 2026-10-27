import { describe, expect, it } from 'vitest'

import type { ShoppingList } from './shopping'
import { type ShoppingOp, applyOps, confirmItem } from './shoppingOps'

const MILK = 'fluent-emoji-flat:glass-of-milk'
const BREAD = 'fluent-emoji-flat:bread'

const LIST: ShoppingList = {
  items: [
    { id: 1, name: 'Milch', icon: MILK, note: '2 ×', checked: false, area: null, position: null },
    {
      id: 2,
      name: 'Eier',
      icon: 'fluent-emoji-flat:egg',
      note: 'Bio',
      checked: true,
      area: null,
      position: null,
    },
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
      {
        kind: 'check',
        variables: { id: -99, name: 'brot', checked: true },
        tempId: -8,
      },
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
      {
        kind: 'check',
        variables: { id: 1, name: 'Milch', checked: true },
        tempId: -1,
      },
      { kind: 'clear', variables: undefined, tempId: -2 },
    ])
    expect(list.items).toEqual([])
  })

  it('übernimmt den bestätigten Artikel an Stelle des vorläufigen', () => {
    const pending = applyOps(LIST, [add('Brot')])
    const confirmed = {
      id: 9,
      name: 'Brot',
      icon: BREAD,
      note: null,
      checked: false,
      area: null,
      position: null,
    }
    expect(confirmItem(pending, confirmed).items.map((item) => item.id)).toEqual([1, 9, 2])
    expect(confirmItem(LIST, confirmed).items.map((item) => item.id)).toEqual([1, 9, 2])
  })

  it('verschiebt in einen anderen Bereich, dort zunächst ohne festen Platz', () => {
    const sorted = { items: LIST.items.map((item) => ({ ...item, position: 3 })) }
    const list = applyOps(sorted, [
      { kind: 'move', variables: { id: 1, name: 'Milch', area: 'drugstore' }, tempId: -1 },
    ])
    expect(list.items[0]).toMatchObject({ area: 'drugstore', position: null })
    expect(list.items[1]).toMatchObject({ area: null, position: 3 })
  })

  it('setzt die Reihenfolge, auch für offline Eingetragenes', () => {
    const list = applyOps(LIST, [
      add('Brot'),
      {
        kind: 'order',
        variables: {
          items: [
            { id: -99, name: 'brot' },
            { id: 1, name: 'Milch' },
          ],
        },
        tempId: -8,
      },
    ])
    expect(list.items.map((item) => [item.name, item.position])).toEqual([
      ['Milch', 1],
      ['Brot', 0],
      ['Eier', null],
    ])
  })

  it('behält Bereich und Platz, wenn ein Artikel neu eingetragen wird', () => {
    const removed = { items: [{ ...LIST.items[1], area: 'online' as const, position: 2 }] }
    const list = applyOps(removed, [add('Eier')])
    expect(list.items[0]).toMatchObject({ checked: false, area: 'online', position: 2 })
  })

  it('ändert einen Eintrag, auch einen offline eingetragenen', () => {
    const edit = (id: number, name: string, newName: string): ShoppingOp => ({
      kind: 'edit',
      variables: { id, name, newName, icon: MILK, note: '' },
      tempId: -8,
    })
    const list = applyOps(LIST, [add('Mlich'), edit(-99, 'mlich', 'Hafermilch')])
    expect(list.items.map((item) => [item.id, item.name, item.note])).toEqual([
      [1, 'Milch', '2 ×'],
      [-7, 'Hafermilch', null],
      [2, 'Eier', 'Bio'],
    ])
  })

  it('macht aus einem Eintrag mit dem Namen eines anderen einen', () => {
    const list = applyOps(LIST, [
      add('Mlich'),
      {
        kind: 'edit',
        variables: { id: -7, name: 'Mlich', newName: 'milch', icon: MILK, note: '3' },
        tempId: -8,
      },
    ])
    expect(list.items.map((item) => [item.id, item.name, item.note, item.checked])).toEqual([
      [1, 'Milch', '3', false],
      [2, 'Eier', 'Bio', true],
    ])
  })
})
