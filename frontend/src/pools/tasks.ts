import type { TFunction } from 'i18next'

import type { Recurrence, TimeOfDay } from '../api/tasks'
import { iconId } from '../icons/catalog'
import { WORKDAYS } from '../weekdays'

/** Gruppen der Vorlagen: Aufgaben für Kinder und Haushalt (Care-Arbeit der Erwachsenen). */
export const TASK_TEMPLATE_GROUPS = ['kids', 'household'] as const
export type TaskTemplateGroup = (typeof TASK_TEMPLATE_GROUPS)[number]

export type TemplateRecurrence =
  Exclude<Recurrence, { kind: 'flexible' }> | { kind: 'flexible'; interval_days: number }

export interface TaskTemplate {
  /** Schlüssel für den Titel in locales/<sprache>/pool.json (`tasks.<id>`). */
  id: string
  group: TaskTemplateGroup
  /** Name im Icon-Katalog (src/icons/categories.json). */
  icon: string
  points: number
  time_of_day: TimeOfDay | null
  /** Flexible Vorlagen bekommen beim Übernehmen heute als erste Fälligkeit. */
  recurrence: TemplateRecurrence
  /** Punkte erst nach Kontrolle durch die Eltern. */
  needs_approval?: boolean
  /** „Einer für alle“ (typisch im Haushalt). */
  shared?: boolean
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
    needs_approval: true,
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
    needs_approval: true,
  },
  {
    id: 'lunchbox',
    group: 'household',
    icon: 'bento-box',
    points: 1,
    time_of_day: 'morning',
    recurrence: { kind: 'weekly', weekdays: WORKDAYS },
    shared: true,
  },
  {
    id: 'drop_off',
    group: 'household',
    icon: 'school',
    points: 1,
    time_of_day: 'morning',
    recurrence: { kind: 'weekly', weekdays: WORKDAYS },
    shared: true,
  },
  {
    id: 'pick_up',
    group: 'household',
    icon: 'house-with-garden',
    points: 1,
    time_of_day: 'afternoon',
    recurrence: { kind: 'weekly', weekdays: WORKDAYS },
    shared: true,
  },
  {
    id: 'cook',
    group: 'household',
    icon: 'cooking',
    points: 1,
    time_of_day: 'evening',
    recurrence: { kind: 'daily' },
    shared: true,
  },
  {
    id: 'dishwasher',
    group: 'household',
    icon: 'sponge',
    points: 1,
    time_of_day: null,
    recurrence: { kind: 'daily' },
    shared: true,
  },
  {
    id: 'bedtime',
    group: 'household',
    icon: 'sleeping-face',
    points: 1,
    time_of_day: 'evening',
    recurrence: { kind: 'daily' },
    shared: true,
  },
  {
    id: 'laundry',
    group: 'household',
    icon: 'basket',
    points: 1,
    time_of_day: null,
    recurrence: { kind: 'daily' },
    shared: true,
  },
  {
    id: 'groceries',
    group: 'household',
    icon: 'shopping-cart',
    points: 1,
    time_of_day: null,
    recurrence: { kind: 'flexible', interval_days: 7 },
    shared: true,
  },
  {
    id: 'clean_bathroom',
    group: 'household',
    icon: 'toilet',
    points: 1,
    time_of_day: null,
    recurrence: { kind: 'flexible', interval_days: 7 },
    shared: true,
  },
  {
    id: 'vacuum',
    group: 'household',
    icon: 'broom',
    points: 1,
    time_of_day: null,
    recurrence: { kind: 'flexible', interval_days: 7 },
    shared: true,
  },
  {
    id: 'trash',
    group: 'household',
    icon: 'wastebasket',
    points: 1,
    time_of_day: null,
    recurrence: { kind: 'daily' },
    shared: true,
  },
  {
    id: 'appointments',
    group: 'household',
    icon: 'tear-off-calendar',
    points: 1,
    time_of_day: null,
    recurrence: { kind: 'flexible', interval_days: 7 },
    shared: true,
  },
]

export const taskTemplateTitle = (t: TFunction, template: TaskTemplate) =>
  t(`tasks.${template.id}`, { ns: 'pool' })

export const taskTemplateIcon = (template: TaskTemplate) => iconId(template.icon)
