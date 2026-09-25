import type { TFunction } from 'i18next'

import type { Recurrence, TimeOfDay } from '../api/tasks'
import { iconId } from '../icons/catalog'
import { WORKDAYS } from '../weekdays'

/** Gruppen der Vorlagen: Aufgaben für Kinder und Haushalt (Care-Arbeit der Erwachsenen). */
export const TASK_TEMPLATE_GROUPS = ['kids', 'household'] as const
export type TaskTemplateGroup = (typeof TASK_TEMPLATE_GROUPS)[number]

export interface TaskTemplate {
  /** Schlüssel für den Titel in locales/<sprache>/pool.json (`tasks.<id>`). */
  id: string
  group: TaskTemplateGroup
  /** Name im Icon-Katalog (src/icons/categories.json). */
  icon: string
  points: number
  time_of_day: TimeOfDay | null
  recurrence: Recurrence
}

/** Vorlagen für neue Aufgaben; sie füllen den Editor nur vor, alles bleibt änderbar. */
export const TASK_POOL: readonly TaskTemplate[] = [
  {
    id: 'teeth_morning',
    group: 'kids',
    icon: 'toothbrush',
    points: 2,
    time_of_day: 'morning',
    recurrence: { kind: 'daily' },
  },
  {
    id: 'get_dressed',
    group: 'kids',
    icon: 't-shirt',
    points: 2,
    time_of_day: 'morning',
    recurrence: { kind: 'daily' },
  },
  {
    id: 'make_bed',
    group: 'kids',
    icon: 'bed',
    points: 2,
    time_of_day: 'morning',
    recurrence: { kind: 'daily' },
  },
  {
    id: 'homework',
    group: 'kids',
    icon: 'books',
    points: 3,
    time_of_day: 'afternoon',
    recurrence: { kind: 'weekly', weekdays: WORKDAYS },
  },
  {
    id: 'tidy_toys',
    group: 'kids',
    icon: 'teddy-bear',
    points: 3,
    time_of_day: 'afternoon',
    recurrence: { kind: 'daily' },
  },
  {
    id: 'clear_table',
    group: 'kids',
    icon: 'fork-and-knife-with-plate',
    points: 3,
    time_of_day: 'evening',
    recurrence: { kind: 'daily' },
  },
  {
    id: 'laundry_basket',
    group: 'kids',
    icon: 'basket',
    points: 1,
    time_of_day: 'evening',
    recurrence: { kind: 'daily' },
  },
  {
    id: 'kita_bag',
    group: 'kids',
    icon: 'backpack',
    points: 2,
    time_of_day: 'evening',
    recurrence: { kind: 'weekly', weekdays: WORKDAYS },
  },
  {
    id: 'teeth_evening',
    group: 'kids',
    icon: 'toothbrush',
    points: 2,
    time_of_day: 'evening',
    recurrence: { kind: 'daily' },
  },
  {
    id: 'read',
    group: 'kids',
    icon: 'open-book',
    points: 2,
    time_of_day: 'evening',
    recurrence: { kind: 'daily' },
  },
  {
    id: 'take_out_trash',
    group: 'kids',
    icon: 'wastebasket',
    points: 3,
    time_of_day: null,
    recurrence: { kind: 'daily' },
  },
  {
    id: 'help_tidy',
    group: 'kids',
    icon: 'broom',
    points: 5,
    time_of_day: null,
    recurrence: { kind: 'weekly', weekdays: [6] },
  },
  {
    id: 'lunchbox',
    group: 'household',
    icon: 'bento-box',
    points: 1,
    time_of_day: 'morning',
    recurrence: { kind: 'weekly', weekdays: WORKDAYS },
  },
  {
    id: 'drop_off',
    group: 'household',
    icon: 'school',
    points: 1,
    time_of_day: 'morning',
    recurrence: { kind: 'weekly', weekdays: WORKDAYS },
  },
  {
    id: 'pick_up',
    group: 'household',
    icon: 'house-with-garden',
    points: 1,
    time_of_day: 'afternoon',
    recurrence: { kind: 'weekly', weekdays: WORKDAYS },
  },
  {
    id: 'cook',
    group: 'household',
    icon: 'cooking',
    points: 1,
    time_of_day: 'evening',
    recurrence: { kind: 'daily' },
  },
  {
    id: 'dishwasher',
    group: 'household',
    icon: 'sponge',
    points: 1,
    time_of_day: null,
    recurrence: { kind: 'daily' },
  },
  {
    id: 'bedtime',
    group: 'household',
    icon: 'sleeping-face',
    points: 1,
    time_of_day: 'evening',
    recurrence: { kind: 'daily' },
  },
  {
    id: 'laundry',
    group: 'household',
    icon: 'basket',
    points: 1,
    time_of_day: null,
    recurrence: { kind: 'daily' },
  },
  {
    id: 'groceries',
    group: 'household',
    icon: 'shopping-cart',
    points: 1,
    time_of_day: null,
    recurrence: { kind: 'weekly', weekdays: [6] },
  },
  {
    id: 'clean_bathroom',
    group: 'household',
    icon: 'toilet',
    points: 1,
    time_of_day: null,
    recurrence: { kind: 'weekly', weekdays: [6] },
  },
  {
    id: 'vacuum',
    group: 'household',
    icon: 'broom',
    points: 1,
    time_of_day: null,
    recurrence: { kind: 'weekly', weekdays: [6] },
  },
  {
    id: 'trash',
    group: 'household',
    icon: 'wastebasket',
    points: 1,
    time_of_day: null,
    recurrence: { kind: 'daily' },
  },
  {
    id: 'appointments',
    group: 'household',
    icon: 'tear-off-calendar',
    points: 1,
    time_of_day: null,
    recurrence: { kind: 'weekly', weekdays: [6] },
  },
]

export const taskTemplateTitle = (t: TFunction, template: TaskTemplate) =>
  t(`tasks.${template.id}`, { ns: 'pool' })

export const taskTemplateIcon = (template: TaskTemplate) => iconId(template.icon)
