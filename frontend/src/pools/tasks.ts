import type { TFunction } from 'i18next'

import type { Recurrence, TaskData, TimeOfDay } from '../api/tasks'
import { iconId } from '../icons/catalog'
import { WORKDAYS } from '../weekdays'

export type TemplateRecurrence =
  Exclude<Recurrence, { kind: 'flexible' }> | { kind: 'flexible'; interval_days: number }

export interface TaskTemplate {
  /** Schlüssel für den Titel in locales/<sprache>/pool.json (`tasks.<id>`). */
  id: string
  /** Name im Icon-Katalog (src/icons/categories.json). */
  icon: string
  points: number
  time_of_day: TimeOfDay | null
  /** Flexible Vorlagen bekommen beim Übernehmen heute als erste Fälligkeit. */
  recurrence: TemplateRecurrence
  /** Punkte erst nach Kontrolle durch die Eltern. */
  needs_approval?: boolean
  /** Freiwillige Extra-Aufgabe statt Teil einer Routine. */
  extra?: boolean
}

const DAILY: TemplateRecurrence = { kind: 'daily' }
const ON_WORKDAYS: TemplateRecurrence = { kind: 'weekly', weekdays: WORKDAYS }
const every = (interval_days: number): TemplateRecurrence => ({ kind: 'flexible', interval_days })

/**
 * Vorlagen für neue Aufgaben; sie füllen den Editor nur vor, alles bleibt änderbar.
 * Kurze Routinen aus dem echten Alltag der Kinder (morgens fertig machen, nach Kita/Schule
 * ankommen, abends aufräumen und ins Bett) plus freiwillige Extras. Hausarbeit der Erwachsenen
 * steht im Putzplan (pools/chores.ts).
 */
export const TASK_POOL: readonly TaskTemplate[] = [
  // Kinder, morgens
  {
    id: 'teeth_morning',
    icon: 'toothbrush',
    points: 2,
    time_of_day: 'morning',
    recurrence: DAILY,
  },
  {
    id: 'get_dressed',
    icon: 't-shirt',
    points: 2,
    time_of_day: 'morning',
    recurrence: DAILY,
  },
  {
    id: 'breakfast',
    icon: 'bowl-with-spoon',
    points: 1,
    time_of_day: 'morning',
    recurrence: DAILY,
  },
  // Kinder, nach Kita oder Schule
  {
    id: 'hang_backpack',
    icon: 'backpack',
    points: 1,
    time_of_day: 'afternoon',
    recurrence: ON_WORKDAYS,
  },
  {
    id: 'unpack_lunchbox',
    icon: 'bento-box',
    points: 1,
    time_of_day: 'afternoon',
    recurrence: ON_WORKDAYS,
  },
  {
    id: 'homework',
    icon: 'books',
    points: 3,
    time_of_day: 'afternoon',
    recurrence: ON_WORKDAYS,
  },
  // Kinder, abends
  {
    id: 'tidy_toys',
    icon: 'teddy-bear',
    points: 3,
    time_of_day: 'evening',
    recurrence: DAILY,
    needs_approval: true,
  },
  {
    id: 'pajamas',
    icon: 'pajamas',
    points: 2,
    time_of_day: 'evening',
    recurrence: DAILY,
  },
  {
    id: 'teeth_evening',
    icon: 'toothbrush',
    points: 2,
    time_of_day: 'evening',
    recurrence: DAILY,
  },
  {
    id: 'go_to_bed',
    icon: 'bed',
    points: 2,
    time_of_day: 'evening',
    recurrence: DAILY,
  },
  // Kinder, freiwillige Extras
  {
    id: 'set_table',
    icon: 'fork-and-knife',
    points: 2,
    time_of_day: null,
    recurrence: DAILY,
    extra: true,
  },
  {
    id: 'clear_table',
    icon: 'fork-and-knife-with-plate',
    points: 2,
    time_of_day: null,
    recurrence: DAILY,
    extra: true,
  },
  {
    id: 'help_cook',
    icon: 'cooking',
    points: 3,
    time_of_day: null,
    recurrence: DAILY,
    extra: true,
  },
  {
    id: 'water_plants',
    icon: 'potted-plant',
    points: 2,
    time_of_day: null,
    recurrence: every(4),
    extra: true,
  },
  {
    id: 'help_tidy',
    icon: 'broom',
    points: 5,
    time_of_day: null,
    recurrence: { kind: 'weekly', weekdays: [6] },
    needs_approval: true,
    extra: true,
  },
]

export const taskTemplateTitle = (t: TFunction, template: TaskTemplate) =>
  t(`tasks.${template.id}`, { ns: 'pool' })

export const taskTemplateIcon = (template: TaskTemplate) => iconId(template.icon)

/** Aufgabe aus einer Vorlage, wie sie der Editor nach „Aus Vorlagen wählen“ speichern würde. */
export function templateTask(
  template: TaskTemplate,
  title: string,
  memberIds: number[],
  today: string,
): TaskData {
  const { recurrence } = template
  return {
    title,
    icon: taskTemplateIcon(template),
    description: '',
    points: template.points,
    time_of_day: template.extra ? null : template.time_of_day,
    extra: template.extra ?? false,
    color: null,
    active: true,
    needs_approval: template.needs_approval ?? false,
    shared: false,
    // Flexible Aufgaben sind ab heute fällig.
    recurrence: recurrence.kind === 'flexible' ? { ...recurrence, date: today } : recurrence,
    member_ids: memberIds,
  }
}
