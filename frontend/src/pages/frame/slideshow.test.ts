import { describe, expect, it } from 'vitest'

import { drawNext, fillsScreen, shuffle } from './slideshow'

/** Zufall mit fester Folge, damit die Tests wiederholbar sind. */
function seeded(values: number[]) {
  let i = 0
  return () => values[i++ % values.length]
}

describe('Mischen ohne Wiederholung', () => {
  it('mischt eine Kopie und behält alle Einträge', () => {
    const ids = [1, 2, 3, 4, 5]
    const mixed = shuffle(ids, seeded([0.9, 0.1, 0.5, 0.3]))
    expect(ids).toEqual([1, 2, 3, 4, 5])
    expect([...mixed].sort()).toEqual(ids)
  })

  it('zeigt jedes Foto einmal, bevor eines wiederkommt', () => {
    const ids = [1, 2, 3, 4, 5]
    let bag: number[] = []
    let last: number | null = null
    const shown: number[] = []
    for (let round = 0; round < 3 * ids.length; round++) {
      const next = drawNext(bag, ids, last)
      shown.push(next.id!)
      bag = next.bag
      last = next.id!
    }
    for (let round = 0; round < 3; round++) {
      expect([...shown.slice(round * 5, round * 5 + 5)].sort()).toEqual(ids)
    }
    // Auch über die Rundengrenze hinweg nie zweimal dasselbe Foto hintereinander.
    shown.slice(1).forEach((id, index) => expect(id).not.toBe(shown[index]))
  })

  it('beginnt eine neue Runde nicht mit dem zuletzt gezeigten Foto', () => {
    // random() = 0.99 lässt die Reihenfolge unverändert, das erste wäre also die 1.
    const next = drawNext([], [1, 2, 3], 1, () => 0.99)
    expect(next.id).not.toBe(1)
    expect([next.id, ...next.bag].sort()).toEqual([1, 2, 3])
  })

  it('lässt gelöschte Fotos aus und nimmt neue in der nächsten Runde mit', () => {
    expect(drawNext([2, 3], [1, 3, 4], 1)).toEqual({ id: 3, bag: [] })
    const next = drawNext([], [1, 3, 4], 3)
    expect([next.id, ...next.bag].sort()).toEqual([1, 3, 4])
  })

  it('liefert nichts ohne Fotos und das einzige Foto immer wieder', () => {
    expect(drawNext([], [], null).id).toBeUndefined()
    expect(drawNext([], [7], 7).id).toBe(7)
  })
})

describe('Einpassen', () => {
  const landscape = { width: 1920, height: 1080 }

  it('füllt den Bildschirm bei ähnlichem Seitenverhältnis', () => {
    expect(fillsScreen({ width: 2560, height: 1440 }, landscape)).toBe(true)
    expect(fillsScreen({ width: 2560, height: 1600 }, landscape)).toBe(true)
  })

  it('zeigt Hochformat und stark abweichende Fotos ganz', () => {
    expect(fillsScreen({ width: 1440, height: 2560 }, landscape)).toBe(false)
    expect(fillsScreen({ width: 2560, height: 1920 }, landscape)).toBe(false)
    expect(fillsScreen({ width: 1440, height: 2560 }, { width: 1080, height: 1920 })).toBe(true)
  })
})
