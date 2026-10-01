import type { TFunction } from 'i18next'

import type { SetupRoom } from '../api/chores'
import { iconId } from '../icons/catalog'

/** Wie gründlich der Haushalt geführt wird; streckt oder staucht alle Abstände. */
export const PACES = ['relaxed', 'normal', 'thorough'] as const
export type Pace = (typeof PACES)[number]

/** Antworten aus dem Einrichtungs-Assistenten. */
export interface HomeProfile {
  home: 'flat' | 'house'
  /** 1 bis 3; das dritte ist ein Gäste-WC. */
  bathrooms: number
  garden: boolean
  balcony: boolean
  robot: boolean
  dishwasher: boolean
  dryer: boolean
  pets: boolean
  car: boolean
  fireplace: boolean
  kids: boolean
  paperwork: boolean
  pace: Pace
}

export const MAX_BATHROOMS = 3

export const DEFAULT_PROFILE: HomeProfile = {
  home: 'flat',
  bathrooms: 1,
  garden: false,
  balcony: false,
  robot: false,
  dishwasher: true,
  dryer: false,
  pets: false,
  car: false,
  fireplace: false,
  kids: false,
  paperwork: true,
  pace: 'normal',
}

/** Schalter des Assistenten, in der Reihenfolge der Anzeige. */
export const PROFILE_SWITCHES = [
  'garden',
  'balcony',
  'robot',
  'dishwasher',
  'dryer',
  'pets',
  'car',
  'fireplace',
  'kids',
  'paperwork',
] as const satisfies readonly (keyof HomeProfile)[]

type Condition = (profile: HomeProfile) => boolean

interface ChoreTemplate {
  /** Schlüssel für den Titel in locales/<sprache>/pool.json (`chores.<id>`). */
  id: string
  /** Name im Icon-Katalog (src/icons/categories.json). */
  icon: string
  /** Abstand in Tagen bei normalem Tempo. */
  days: number
  /** Nur vorschlagen, wenn die Antworten dazu passen. */
  when?: Condition
}

interface RoomTemplate {
  /** Schlüssel für den Namen in locales/<sprache>/pool.json (`chore_rooms.<id>`). */
  id: string
  icon: string
  when?: Condition
  chores: readonly ChoreTemplate[]
}

const BATHROOM_CHORES: readonly ChoreTemplate[] = [
  { id: 'toilet', icon: 'toilet', days: 7 },
  { id: 'washbasin', icon: 'soap', days: 7 },
  { id: 'towels', icon: 'bubbles', days: 7 },
  { id: 'shower', icon: 'shower', days: 14 },
  { id: 'bath_floor', icon: 'bucket', days: 14 },
  { id: 'drains', icon: 'plunger', days: 90 },
  { id: 'tiles', icon: 'sponge', days: 180 },
]

// Wird seltener benutzt, also seltener geputzt; ohne Dusche.
const GUEST_WC_CHORES: readonly ChoreTemplate[] = [
  { id: 'toilet', icon: 'toilet', days: 14 },
  { id: 'washbasin', icon: 'soap', days: 14 },
  { id: 'towels', icon: 'bubbles', days: 14 },
  { id: 'bath_floor', icon: 'bucket', days: 30 },
]

/** Bäder nach Anzahl und Wohnform: im Haus „oben“ und „unten“, das dritte ist das Gäste-WC. */
function bathrooms(profile: HomeProfile): RoomTemplate[] {
  const count = Math.min(Math.max(profile.bathrooms, 1), MAX_BATHROOMS)
  const ids =
    count === 1
      ? ['bathroom']
      : profile.home === 'house'
        ? ['bathroom_up', 'bathroom_down']
        : ['bathroom', 'bathroom_second']
  const rooms: RoomTemplate[] = ids.map((id) => ({ id, icon: 'bathtub', chores: BATHROOM_CHORES }))
  if (count === MAX_BATHROOMS)
    rooms.push({ id: 'guest_wc', icon: 'toilet', chores: GUEST_WC_CHORES })
  return rooms
}

const KITCHEN: RoomTemplate = {
  id: 'kitchen',
  icon: 'cooking',
  chores: [
    { id: 'trash', icon: 'wastebasket', days: 3 },
    { id: 'recycling', icon: 'recycling-symbol', days: 7 },
    { id: 'stove', icon: 'shallow-pan-of-food', days: 7 },
    { id: 'sink', icon: 'droplet', days: 7 },
    { id: 'kitchen_floor', icon: 'bucket', days: 7 },
    { id: 'dishcloths', icon: 'sponge', days: 7 },
    { id: 'fridge', icon: 'snowflake', days: 30 },
    { id: 'dishwasher_clean', icon: 'bubbles', days: 30, when: (p) => p.dishwasher },
    { id: 'descale', icon: 'hot-beverage', days: 60 },
    { id: 'oven', icon: 'pizza', days: 90 },
    { id: 'extractor', icon: 'wrench', days: 90 },
    { id: 'cupboards', icon: 'jar', days: 180 },
  ],
}

const ROOMS_AFTER_BATHROOMS: readonly RoomTemplate[] = [
  {
    id: 'living',
    icon: 'couch-and-lamp',
    chores: [
      { id: 'ashes', icon: 'candle', days: 7, when: (p) => p.fireplace },
      { id: 'plants', icon: 'potted-plant', days: 7 },
      { id: 'dust', icon: 'sparkles', days: 14 },
      { id: 'sofa', icon: 'couch-and-lamp', days: 60 },
      { id: 'blankets', icon: 'basket', days: 90 },
    ],
  },
  {
    id: 'bedroom',
    icon: 'bed',
    chores: [
      { id: 'bedding', icon: 'bed', days: 14 },
      { id: 'dust', icon: 'sparkles', days: 30 },
      { id: 'mattress', icon: 'zzz', days: 180 },
      { id: 'wardrobe', icon: 'coat', days: 180 },
    ],
  },
  {
    id: 'kids_room',
    icon: 'teddy-bear',
    when: (p) => p.kids,
    chores: [
      { id: 'bedding', icon: 'bed', days: 14 },
      { id: 'dust', icon: 'sparkles', days: 30 },
      { id: 'toys_sort', icon: 'puzzle-piece', days: 90 },
      { id: 'kids_clothes', icon: 't-shirt', days: 180 },
    ],
  },
  {
    id: 'everywhere',
    icon: 'broom',
    chores: [
      // Mit Saugroboter verschiebt sich die Arbeit: leeren und pflegen statt selbst saugen.
      { id: 'vacuum', icon: 'broom', days: 7, when: (p) => !p.robot },
      { id: 'stairs', icon: 'broom', days: 7, when: (p) => p.home === 'house' && !p.robot },
      { id: 'robot_empty', icon: 'robot', days: 7, when: (p) => p.robot },
      { id: 'vacuum_corners', icon: 'broom', days: 14, when: (p) => p.robot },
      { id: 'robot_clean', icon: 'wrench', days: 30, when: (p) => p.robot },
      { id: 'mop', icon: 'bucket', days: 14 },
      { id: 'hallway', icon: 'running-shoe', days: 14 },
      { id: 'doors', icon: 'door', days: 90 },
      { id: 'windows', icon: 'window', days: 180 },
      { id: 'lamps', icon: 'light-bulb', days: 180 },
      { id: 'smoke_detectors', icon: 'bell', days: 365 },
    ],
  },
  {
    id: 'laundry',
    icon: 'basket',
    chores: [
      { id: 'laundry', icon: 'basket', days: 3 },
      { id: 'dryer_clean', icon: 'socks', days: 30, when: (p) => p.dryer },
      { id: 'washer_clean', icon: 'bubbles', days: 60 },
    ],
  },
  {
    id: 'garden',
    icon: 'deciduous-tree',
    when: (p) => p.garden,
    chores: [
      { id: 'water_beds', icon: 'droplet', days: 3 },
      { id: 'mow', icon: 'seedling', days: 10 },
      { id: 'weeds', icon: 'herb', days: 21 },
      { id: 'terrace', icon: 'broom', days: 30 },
      { id: 'hedge', icon: 'evergreen-tree', days: 180 },
      { id: 'gutters', icon: 'umbrella', days: 365, when: (p) => p.home === 'house' },
      { id: 'shed', icon: 'toolbox', days: 365 },
    ],
  },
  {
    id: 'balcony',
    icon: 'sunflower',
    when: (p) => p.balcony,
    chores: [
      { id: 'balcony_plants', icon: 'tulip', days: 3 },
      { id: 'balcony_sweep', icon: 'broom', days: 30 },
      { id: 'balcony_furniture', icon: 'chair', days: 180 },
    ],
  },
  {
    id: 'outside',
    icon: 'house-with-garden',
    when: (p) => p.home === 'house',
    chores: [
      { id: 'bins', icon: 'litter-in-bin-sign', days: 7 },
      { id: 'sidewalk', icon: 'broom', days: 14 },
      { id: 'bins_clean', icon: 'bucket', days: 180 },
      { id: 'heating', icon: 'wrench', days: 365 },
      { id: 'basement', icon: 'package', days: 365 },
    ],
  },
  {
    id: 'pets',
    icon: 'paw-prints',
    when: (p) => p.pets,
    chores: [
      { id: 'pet_home', icon: 'bird', days: 7 },
      { id: 'pet_bowls', icon: 'bowl-with-spoon', days: 7 },
      { id: 'pet_food', icon: 'bone', days: 30 },
      { id: 'vet', icon: 'stethoscope', days: 365 },
    ],
  },
  {
    id: 'car',
    icon: 'automobile',
    when: (p) => p.car,
    chores: [
      { id: 'car_check', icon: 'wrench', days: 60 },
      { id: 'car_inside', icon: 'automobile', days: 60 },
      { id: 'car_wash', icon: 'droplet', days: 60 },
      { id: 'tyres', icon: 'snowflake', days: 180 },
    ],
  },
  {
    id: 'paperwork',
    icon: 'card-file-box',
    when: (p) => p.paperwork,
    chores: [
      { id: 'mail', icon: 'envelope', days: 7 },
      { id: 'filing', icon: 'card-file-box', days: 30 },
      { id: 'backup', icon: 'laptop', days: 30 },
      { id: 'phone_photos', icon: 'mobile-phone', days: 90 },
      { id: 'contracts', icon: 'coin', days: 365 },
      { id: 'taxes', icon: 'money-bag', days: 365 },
      { id: 'medicine', icon: 'pill', days: 365 },
    ],
  },
]

/** Alle Raumvorlagen, die es je nach Antworten geben kann (für Tests und Übersetzungen). */
export const ALL_ROOM_TEMPLATES: readonly RoomTemplate[] = [
  KITCHEN,
  ...(['bathroom', 'bathroom_up', 'bathroom_down', 'bathroom_second'] as const).map((id) => ({
    id,
    icon: 'bathtub',
    chores: BATHROOM_CHORES,
  })),
  { id: 'guest_wc', icon: 'toilet', chores: GUEST_WC_CHORES },
  ...ROOMS_AFTER_BATHROOMS,
]

const PACE_FACTORS: Record<Pace, number> = { relaxed: 1.5, normal: 1, thorough: 0.7 }

/** Abstände, die sich gut lesen: Tage, Wochen, Monate, Jahre. */
const NICE_DAYS = [1, 2, 3, 4, 5, 7, 10, 14, 21, 30, 42, 60, 90, 120, 180, 270, 365, 540, 730]

/** Abstand für das gewählte Tempo, auf einen gut lesbaren Wert gerundet. */
export function paceInterval(days: number, pace: Pace): number {
  if (pace === 'normal') return days
  const target = days * PACE_FACTORS[pace]
  return NICE_DAYS.reduce((best, candidate) =>
    Math.abs(Math.log(candidate / target)) < Math.abs(Math.log(best / target)) ? candidate : best,
  )
}

export interface SuggestedRoom extends SetupRoom {
  /** Stabiler Schlüssel der Vorlage, z. B. „bathroom_up“. */
  key: string
  chores: (SetupRoom['chores'][number] & { key: string })[]
}

/** Vorschlag für den Putzplan: Räume und Aufgaben passend zu den Antworten, in der Sprache von `t`. */
export function suggestPlan(t: TFunction, profile: HomeProfile): SuggestedRoom[] {
  return [KITCHEN, ...bathrooms(profile), ...ROOMS_AFTER_BATHROOMS]
    .filter((room) => room.when?.(profile) ?? true)
    .map((room) => ({
      key: room.id,
      name: t(`chore_rooms.${room.id}`, { ns: 'pool' }),
      icon: iconId(room.icon),
      chores: room.chores
        .filter((chore) => chore.when?.(profile) ?? true)
        .map((chore) => ({
          key: `${room.id}.${chore.id}`,
          title: t(`chores.${chore.id}`, { ns: 'pool' }),
          icon: iconId(chore.icon),
          interval_days: paceInterval(chore.days, profile.pace),
        })),
    }))
}
