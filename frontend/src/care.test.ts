import { describe, expect, it } from 'vitest'

import { careShares } from './care'
import { makeMember, makeToday } from './test/utils'

const mama = makeMember({ id: 1, name: 'Mama', role: 'parent', color: 'blue' })
const papa = makeMember({ id: 2, name: 'Papa', role: 'parent', color: 'orange' })
const oma = makeMember({ id: 3, name: 'Oma', role: 'parent', color: 'teal' })
const lena = makeMember({ id: 4, name: 'Lena' })

const today = (weekDone: Record<number, number>) =>
  makeToday({
    points: Object.entries(weekDone).map(([id, done]) => ({
      member_id: Number(id),
      today: 0,
      total: 0,
      week_done: done,
    })),
  })

describe('Faire Verteilung', () => {
  it('teilt die Aufgaben der Erwachsenen auf, Kinder zählen nicht', () => {
    const shares = careShares([mama, papa, lena], today({ 1: 6, 2: 9, 4: 20 }))
    expect(shares?.map((share) => [share.member.name, share.done, share.percent])).toEqual([
      ['Mama', 6, 40],
      ['Papa', 9, 60],
    ])
  })

  it('ergibt zusammen immer 100 Prozent', () => {
    const shares = careShares([mama, papa, oma], today({ 1: 1, 2: 1, 3: 1 }))
    expect(shares?.map((share) => share.percent)).toEqual([34, 33, 33])
  })

  it('zeigt ohne Erledigungen 0 und mit nur einem Erwachsenen nichts', () => {
    expect(careShares([mama, papa], today({}))?.map((share) => share.percent)).toEqual([0, 0])
    expect(careShares([mama, lena], today({ 1: 5 }))).toBeNull()
  })
})
