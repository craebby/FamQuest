import { beforeEach, describe, expect, it } from 'vitest'

import type { Chore } from './api/chores'
import {
  byUrgency,
  groupByLevel,
  intervalDays,
  intervalText,
  splitInterval,
  statusText,
} from './chores'
import i18n from './i18n'
import { makeChore } from './test/utils'

beforeEach(async () => {
  await i18n.changeLanguage('de')
})

const t = i18n.t.bind(i18n)

describe('Abstand', () => {
  it('zerlegt Tage in die größte glatte Einheit', () => {
    expect(splitInterval(3)).toEqual({ count: 3, unit: 'day' })
    expect(splitInterval(14)).toEqual({ count: 2, unit: 'week' })
    expect(splitInterval(90)).toEqual({ count: 3, unit: 'month' })
    expect(splitInterval(730)).toEqual({ count: 2, unit: 'year' })
    expect(intervalDays(3, 'week')).toBe(21)
  })

  it('liest sich wie gesprochen', () => {
    expect(intervalText(t, 1)).toBe('jeden Tag')
    expect(intervalText(t, 10)).toBe('alle 10 Tage')
    expect(intervalText(t, 7)).toBe('jede Woche')
    expect(intervalText(t, 42)).toBe('alle 6 Wochen')
    expect(intervalText(t, 180)).toBe('alle 6 Monate')
    expect(intervalText(t, 365)).toBe('jedes Jahr')
  })
})

describe('Stand', () => {
  const status = (overrides: Partial<Chore>) => statusText(t, makeChore(overrides))

  it('nennt die Zeit bis zur Fälligkeit', () => {
    expect(status({ days_left: 4 })).toBe('In 4 Tagen')
    expect(status({ days_left: 1 })).toBe('Morgen fällig')
    expect(status({ days_left: 0 })).toBe('Heute fällig')
    expect(status({ days_left: 20 })).toBe('In etwa 3 Wochen')
    expect(status({ days_left: 150 })).toBe('In etwa 5 Monaten')
  })

  it('nennt, wie lange etwas schon fällig ist', () => {
    expect(status({ days_left: -1 })).toBe('Seit gestern fällig')
    expect(status({ days_left: -3 })).toBe('Seit 3 Tagen fällig')
    expect(status({ days_left: -21 })).toBe('Seit etwa 3 Wochen fällig')
    expect(status({ days_left: -90 })).toBe('Seit etwa 3 Monaten fällig')
  })

  it('zeigt heute Erledigtes als erledigt', () => {
    expect(status({ done_today: true, days_left: 14 })).toBe('Heute erledigt')
  })
})

describe('Reihenfolge', () => {
  const overdue = makeChore({ id: 1, title: 'Bad', ratio: 1.5, level: 'due' })
  const due = makeChore({ id: 2, title: 'Müll', ratio: 1, level: 'due', interval_days: 3 })
  const soon = makeChore({ id: 3, title: 'Wischen', ratio: 0.8, level: 'soon' })
  const fine = makeChore({ id: 4, title: 'Fenster', ratio: 0.1, level: 'ok' })
  const done = makeChore({ id: 5, title: 'Saugen', ratio: 0, level: 'ok', done_today: true })
  const paused = makeChore({ id: 6, title: 'Rasen', ratio: 2, level: 'due', active: false })

  it('stellt das Dringendste nach vorn', () => {
    expect([fine, soon, due, overdue].sort(byUrgency).map((chore) => chore.title)).toEqual([
      'Bad',
      'Müll',
      'Wischen',
      'Fenster',
    ])
  })

  it('gruppiert nach Ampel, ohne Erledigtes und Pausiertes', () => {
    const groups = groupByLevel([fine, done, paused, soon, due, overdue])

    expect(groups.due.map((chore) => chore.id)).toEqual([1, 2])
    expect(groups.soon.map((chore) => chore.id)).toEqual([3])
    expect(groups.ok.map((chore) => chore.id)).toEqual([4])
  })
})
