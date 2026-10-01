import { describe, expect, it } from 'vitest'

import { careShares } from './care'
import { makeMember } from './test/utils'

const mama = makeMember({ id: 1, name: 'Mama', role: 'parent', color: 'blue' })
const papa = makeMember({ id: 2, name: 'Papa', role: 'parent', color: 'orange' })
const oma = makeMember({ id: 3, name: 'Oma', role: 'parent', color: 'teal' })
const lena = makeMember({ id: 4, name: 'Lena' })
const tom = makeMember({ id: 5, name: 'Tom', color: 'green' })

const shares = (counts: Record<number, number>) =>
  Object.entries(counts).map(([id, count]) => ({ member_id: Number(id), count }))

describe('Faire Verteilung', () => {
  it('teilt den Putzplan unter denen auf, die etwas erledigt haben', () => {
    const result = careShares([mama, papa, lena, tom], shares({ 1: 6, 2: 9, 4: 5 }))
    // Tom hat nichts gemacht und ist ein Kind: Er steht nicht dabei.
    expect(result?.map((share) => [share.member.name, share.done, share.percent])).toEqual([
      ['Mama', 6, 30],
      ['Papa', 9, 45],
      ['Lena', 5, 25],
    ])
  })

  it('zeigt Erwachsene auch mit 0 und ergibt zusammen immer 100 Prozent', () => {
    expect(
      careShares([mama, papa, oma], shares({ 1: 1, 2: 1, 3: 1 }))?.map((share) => share.percent),
    ).toEqual([34, 33, 33])
    expect(careShares([mama, papa], shares({ 1: 2 }))?.map((share) => share.percent)).toEqual([
      100, 0,
    ])
  })

  it('zeigt nichts, solange niemand angetippt wurde oder nur eine Person dabei ist', () => {
    expect(careShares([mama, papa], shares({}))).toBeNull()
    expect(careShares([mama, lena], shares({ 1: 5 }))).toBeNull()
  })
})
