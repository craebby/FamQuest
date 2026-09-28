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
  /** Freiwillige Extra-Aufgabe statt Teil einer Routine. */
  extra?: boolean
}

const DAILY: TemplateRecurrence = { kind: 'daily' }
const ON_WORKDAYS: TemplateRecurrence = { kind: 'weekly', weekdays: WORKDAYS }
const every = (interval_days: number): TemplateRecurrence => ({ kind: 'flexible', interval_days })

/**
 * Vorlagen für neue Aufgaben; sie füllen den Editor nur vor, alles bleibt änderbar.
 * Kinder: kurze Routinen aus dem echten Alltag (morgens fertig machen, nach Kita/Schule
 * ankommen, abends aufräumen und ins Bett) plus freiwillige Extras.
 * Haushalt: was immer wieder anfällt, mit realistischen Abständen, inklusive Papierkram.
 */
export const TASK_POOL: readonly TaskTemplate[] = [
  // Kinder, morgens
  {
    id: 'teeth_morning',
    group: 'kids',
    icon: 'toothbrush',
    points: 2,
    time_of_day: 'morning',
    recurrence: DAILY,
  },
  {
    id: 'get_dressed',
    group: 'kids',
    icon: 't-shirt',
    points: 2,
    time_of_day: 'morning',
    recurrence: DAILY,
  },
  {
    id: 'breakfast',
    group: 'kids',
    icon: 'bowl-with-spoon',
    points: 1,
    time_of_day: 'morning',
    recurrence: DAILY,
  },
  // Kinder, nach Kita oder Schule
  {
    id: 'hang_backpack',
    group: 'kids',
    icon: 'backpack',
    points: 1,
    time_of_day: 'afternoon',
    recurrence: ON_WORKDAYS,
  },
  {
    id: 'unpack_lunchbox',
    group: 'kids',
    icon: 'bento-box',
    points: 1,
    time_of_day: 'afternoon',
    recurrence: ON_WORKDAYS,
  },
  {
    id: 'homework',
    group: 'kids',
    icon: 'books',
    points: 3,
    time_of_day: 'afternoon',
    recurrence: ON_WORKDAYS,
  },
  // Kinder, abends
  {
    id: 'tidy_toys',
    group: 'kids',
    icon: 'teddy-bear',
    points: 3,
    time_of_day: 'evening',
    recurrence: DAILY,
    needs_approval: true,
  },
  {
    id: 'pajamas',
    group: 'kids',
    icon: 'pajamas',
    points: 2,
    time_of_day: 'evening',
    recurrence: DAILY,
  },
  {
    id: 'teeth_evening',
    group: 'kids',
    icon: 'toothbrush',
    points: 2,
    time_of_day: 'evening',
    recurrence: DAILY,
  },
  {
    id: 'go_to_bed',
    group: 'kids',
    icon: 'bed',
    points: 2,
    time_of_day: 'evening',
    recurrence: DAILY,
  },
  // Kinder, freiwillige Extras
  {
    id: 'set_table',
    group: 'kids',
    icon: 'fork-and-knife',
    points: 2,
    time_of_day: null,
    recurrence: DAILY,
    extra: true,
  },
  {
    id: 'clear_table',
    group: 'kids',
    icon: 'fork-and-knife-with-plate',
    points: 2,
    time_of_day: null,
    recurrence: DAILY,
    extra: true,
  },
  {
    id: 'help_cook',
    group: 'kids',
    icon: 'cooking',
    points: 3,
    time_of_day: null,
    recurrence: DAILY,
    extra: true,
  },
  {
    id: 'water_plants',
    group: 'kids',
    icon: 'potted-plant',
    points: 2,
    time_of_day: null,
    recurrence: every(4),
    extra: true,
  },
  {
    id: 'help_tidy',
    group: 'kids',
    icon: 'broom',
    points: 5,
    time_of_day: null,
    recurrence: { kind: 'weekly', weekdays: [6] },
    needs_approval: true,
    extra: true,
  },
  // Haushalt, jeden Tag
  {
    id: 'lay_out_clothes',
    group: 'household',
    icon: 'dress',
    points: 1,
    time_of_day: 'evening',
    recurrence: DAILY,
    shared: true,
  },
  {
    id: 'lunchbox',
    group: 'household',
    icon: 'bento-box',
    points: 1,
    time_of_day: 'morning',
    recurrence: ON_WORKDAYS,
    shared: true,
  },
  {
    id: 'drop_off',
    group: 'household',
    icon: 'school',
    points: 1,
    time_of_day: 'morning',
    recurrence: ON_WORKDAYS,
    shared: true,
  },
  {
    id: 'pick_up',
    group: 'household',
    icon: 'house-with-garden',
    points: 1,
    time_of_day: 'afternoon',
    recurrence: ON_WORKDAYS,
    shared: true,
  },
  {
    id: 'cook',
    group: 'household',
    icon: 'cooking',
    points: 1,
    time_of_day: 'evening',
    recurrence: DAILY,
    shared: true,
  },
  {
    id: 'dishwasher',
    group: 'household',
    icon: 'sponge',
    points: 1,
    time_of_day: null,
    recurrence: DAILY,
    shared: true,
  },
  {
    id: 'bedtime',
    group: 'household',
    icon: 'sleeping-face',
    points: 1,
    time_of_day: 'evening',
    recurrence: DAILY,
    shared: true,
  },
  // Haushalt, alle paar Tage
  {
    id: 'trash',
    group: 'household',
    icon: 'wastebasket',
    points: 1,
    time_of_day: null,
    recurrence: every(2),
    shared: true,
  },
  {
    id: 'laundry',
    group: 'household',
    icon: 'basket',
    points: 1,
    time_of_day: null,
    recurrence: every(3),
    shared: true,
  },
  {
    id: 'fold_laundry',
    group: 'household',
    icon: 'socks',
    points: 1,
    time_of_day: null,
    recurrence: every(3),
    shared: true,
  },
  {
    id: 'groceries',
    group: 'household',
    icon: 'shopping-cart',
    points: 1,
    time_of_day: null,
    recurrence: every(4),
    shared: true,
  },
  {
    id: 'plants',
    group: 'household',
    icon: 'potted-plant',
    points: 1,
    time_of_day: null,
    recurrence: every(4),
    shared: true,
  },
  // Haushalt, wöchentlich und seltener
  {
    id: 'bins',
    group: 'household',
    icon: 'recycling-symbol',
    points: 1,
    time_of_day: null,
    recurrence: every(7),
    shared: true,
  },
  {
    id: 'clean_bathroom',
    group: 'household',
    icon: 'toilet',
    points: 1,
    time_of_day: null,
    recurrence: every(7),
    shared: true,
  },
  {
    id: 'vacuum',
    group: 'household',
    icon: 'broom',
    points: 1,
    time_of_day: null,
    recurrence: every(7),
    shared: true,
  },
  {
    id: 'mop',
    group: 'household',
    icon: 'bucket',
    points: 1,
    time_of_day: null,
    recurrence: every(14),
    shared: true,
  },
  {
    id: 'bed_linen',
    group: 'household',
    icon: 'bed',
    points: 1,
    time_of_day: null,
    recurrence: every(14),
    shared: true,
  },
  {
    id: 'windows',
    group: 'household',
    icon: 'window',
    points: 1,
    time_of_day: null,
    recurrence: every(90),
    shared: true,
  },
  // Haushalt, Organisation und Papierkram
  {
    id: 'appointments',
    group: 'household',
    icon: 'tear-off-calendar',
    points: 1,
    time_of_day: null,
    recurrence: every(7),
    shared: true,
  },
  {
    id: 'mail_bills',
    group: 'household',
    icon: 'envelope',
    points: 1,
    time_of_day: null,
    recurrence: every(7),
    shared: true,
  },
  {
    id: 'filing',
    group: 'household',
    icon: 'card-file-box',
    points: 1,
    time_of_day: null,
    recurrence: every(30),
    shared: true,
  },
  {
    id: 'tech',
    group: 'household',
    icon: 'laptop',
    points: 1,
    time_of_day: null,
    recurrence: every(30),
    shared: true,
  },
  {
    id: 'taxes',
    group: 'household',
    icon: 'abacus',
    points: 1,
    time_of_day: null,
    recurrence: every(365),
    shared: true,
  },
]

export const taskTemplateTitle = (t: TFunction, template: TaskTemplate) =>
  t(`tasks.${template.id}`, { ns: 'pool' })

export const taskTemplateIcon = (template: TaskTemplate) => iconId(template.icon)
