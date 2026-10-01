import { beforeEach, describe, expect, it } from 'vitest'

import i18n, { SUPPORTED_LANGUAGES, resources } from '../i18n'
import { CATALOG_ICONS } from '../icons/catalog'
import {
  ALL_ROOM_TEMPLATES,
  DEFAULT_PROFILE,
  type HomeProfile,
  paceInterval,
  suggestPlan,
} from './chores'

beforeEach(async () => {
  await i18n.changeLanguage('de')
})

const t = i18n.t.bind(i18n)

function plan(overrides: Partial<HomeProfile> = {}) {
  return suggestPlan(t, { ...DEFAULT_PROFILE, ...overrides })
}

const roomNames = (overrides: Partial<HomeProfile> = {}) => plan(overrides).map((room) => room.name)

function titles(overrides: Partial<HomeProfile>, roomName: string) {
  const room = plan(overrides).find((candidate) => candidate.name === roomName)
  return room?.chores.map((chore) => chore.title) ?? []
}

describe('Vorlagen für den Putzplan', () => {
  it('nutzt nur Icons aus dem Katalog', () => {
    for (const room of ALL_ROOM_TEMPLATES) {
      expect(CATALOG_ICONS, room.id).toContain(room.icon)
      for (const chore of room.chores) expect(CATALOG_ICONS, chore.id).toContain(chore.icon)
    }
  })

  for (const language of SUPPORTED_LANGUAGES) {
    it(`${language}: hat für genau die Vorlagen einen Namen`, () => {
      const pool = resources[language].pool as Record<string, Record<string, string>>
      const rooms = ALL_ROOM_TEMPLATES.map((room) => room.id)
      const chores = ALL_ROOM_TEMPLATES.flatMap((room) => room.chores.map((chore) => chore.id))

      expect(Object.keys(pool.chore_rooms).sort()).toEqual([...new Set(rooms)].sort())
      expect(Object.keys(pool.chores).sort()).toEqual([...new Set(chores)].sort())
    })
  }

  it('führt in keinem Raum eine Aufgabe doppelt', () => {
    for (const room of ALL_ROOM_TEMPLATES) {
      const ids = room.chores.map((chore) => chore.id)
      expect(new Set(ids).size, room.id).toBe(ids.length)
    }
  })
})

describe('Vorschlag aus den Antworten', () => {
  it('schlägt für eine einfache Wohnung nur das Nötige vor', () => {
    expect(roomNames()).toEqual([
      'Küche',
      'Bad',
      'Wohnzimmer',
      'Schlafzimmer',
      'Überall',
      'Wäsche',
      'Papierkram und Technik',
    ])
  })

  it('nennt zwei Bäder im Haus „oben“ und „unten“, das dritte ist das Gäste-WC', () => {
    expect(roomNames({ home: 'house', bathrooms: 3 })).toEqual(
      expect.arrayContaining(['Bad oben', 'Bad unten', 'Gäste-WC', 'Rund ums Haus']),
    )
    expect(roomNames({ home: 'flat', bathrooms: 2 })).toEqual(
      expect.arrayContaining(['Bad', 'Zweites Bad']),
    )
    // Das Gäste-WC wird seltener geputzt.
    const guest = plan({ bathrooms: 3 }).find((room) => room.name === 'Gäste-WC')
    expect(guest?.chores.map((chore) => [chore.title, chore.interval_days])).toEqual([
      ['Bad putzen', 14],
      ['Handtücher wechseln', 14],
    ])
  })

  it('schaltet Räume mit den Schaltern zu', () => {
    const all = roomNames({ garden: true, balcony: true, pets: true, car: true, kids: true })

    expect(all).toEqual(
      expect.arrayContaining(['Garten', 'Balkon und Terrasse', 'Tiere', 'Auto', 'Kinderzimmer']),
    )
    expect(roomNames({ paperwork: false })).not.toContain('Papierkram und Technik')
  })

  it('verschiebt mit Saugroboter die Arbeit vom Saugen zum Pflegen', () => {
    const without = titles({ robot: false }, 'Überall')
    const withRobot = titles({ robot: true }, 'Überall')

    expect(without).toContain('Staubsaugen')
    expect(without).not.toContain('Saugroboter leeren')
    expect(withRobot).not.toContain('Staubsaugen')
    expect(withRobot).toEqual(
      expect.arrayContaining([
        'Saugroboter leeren',
        'Saugroboter reinigen (Bürsten, Filter, Sensoren)',
        'Ecken, Treppe und unter Möbeln saugen',
      ]),
    )
  })

  it('schlägt Gerätepflege nur vor, wenn es das Gerät gibt', () => {
    expect(titles({ dishwasher: false }, 'Küche')).not.toContain(
      'Spülmaschine reinigen (Sieb, Salz, Klarspüler)',
    )
    expect(titles({ dryer: true }, 'Wäsche')).toContain(
      'Trockner reinigen (Flusensieb, Kondensator)',
    )
    expect(titles({ fireplace: true }, 'Wohnzimmer')).toContain(
      'Asche leeren und Kaminscheibe putzen',
    )
  })

  it('fasst das Putzen je Raum zusammen und lässt weg, was sich von allein ergibt', () => {
    const everything = plan({ home: 'house', garden: true }).flatMap((room) =>
      room.chores.map((chore) => chore.title),
    )

    expect(titles({}, 'Bad')).toEqual([
      'Bad putzen',
      'Handtücher wechseln',
      'Abflüsse reinigen',
      'Fliesen und Fugen gründlich reinigen',
    ])
    expect(titles({}, 'Küche')[0]).toBe('Küche gründlich putzen')
    expect(everything).not.toContain('Müll rausbringen')
    expect(everything).not.toContain('Mülltonnen rausstellen')
    // Zimmerpflanzen stehen im ganzen Haus, nicht nur im Wohnzimmer.
    expect(titles({}, 'Wohnzimmer')).not.toContain('Zimmerpflanzen gießen')
    expect(titles({}, 'Überall')).toContain('Zimmerpflanzen gießen')
  })

  it('vergibt eindeutige Schlüssel', () => {
    const keys = plan({ home: 'house', bathrooms: 3, garden: true }).flatMap((room) =>
      room.chores.map((chore) => chore.key),
    )
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('Vorauswahl', () => {
  const preselected = (overrides: Partial<HomeProfile> = {}) =>
    plan(overrides).flatMap((room) =>
      room.chores.filter((chore) => chore.preselected).map((chore) => chore.title),
    )

  it('hakt für eine einfache Wohnung nur das Mindeste an', () => {
    expect(preselected()).toEqual([
      'Küche gründlich putzen',
      'Bad putzen',
      'Abflüsse reinigen',
      'Staub wischen',
      'Bettwäsche wechseln',
      'Staubsaugen',
      'Böden wischen',
      'Fenster putzen',
      'Post und Rechnungen erledigen',
    ])
  })

  it('erschlägt auch ein großes Zuhause nicht', () => {
    const everything: Partial<HomeProfile> = {
      home: 'house',
      bathrooms: 3,
      garden: true,
      balcony: true,
      robot: true,
      dryer: true,
      pets: true,
      car: true,
      fireplace: true,
      kids: true,
    }

    expect(preselected(everything).length).toBeLessThanOrEqual(20)
    expect(plan(everything).flatMap((room) => room.chores).length).toBeGreaterThan(50)
  })

  it('wählt Gießen, Wäsche und Auto nicht vor', () => {
    const chosen = preselected({ garden: true, balcony: true, car: true })

    expect(chosen).toEqual(expect.arrayContaining(['Rasen mähen', 'Unkraut jäten']))
    expect(chosen).not.toContain('Beete und Kübel gießen')
    expect(chosen).not.toContain('Wäsche waschen')
    expect(chosen).not.toContain('Auto waschen')
  })
})

describe('Tempo', () => {
  it('lässt normale Abstände unverändert', () => {
    expect(paceInterval(14, 'normal')).toBe(14)
  })

  it('streckt für „locker“ und staucht für „gründlich“ auf gut lesbare Werte', () => {
    expect([3, 7, 14, 30, 90, 180, 365].map((days) => paceInterval(days, 'relaxed'))).toEqual([
      5, 10, 21, 42, 120, 270, 540,
    ])
    expect([3, 7, 14, 30, 90, 180, 365].map((days) => paceInterval(days, 'thorough'))).toEqual([
      2, 5, 10, 21, 60, 120, 270,
    ])
  })

  it('wirkt auf den ganzen Vorschlag', () => {
    const bath = (pace: HomeProfile['pace']) =>
      plan({ pace })
        .find((room) => room.name === 'Bad')
        ?.chores.find((chore) => chore.title === 'Bad putzen')?.interval_days

    expect([bath('relaxed'), bath('normal'), bath('thorough')]).toEqual([10, 7, 5])
  })
})
