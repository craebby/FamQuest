import type { ComponentType, SVGProps } from 'react'
import CheckIcon from '~icons/fluent-emoji-flat/check-mark-button'
import StarIcon from '~icons/fluent-emoji-flat/glowing-star'
import GearIcon from '~icons/fluent-emoji-flat/gear'
import FamilyIcon from '~icons/fluent-emoji-flat/people-hugging'
import CalendarIcon from '~icons/fluent-emoji-flat/spiral-calendar'
import SunriseIcon from '~icons/fluent-emoji-flat/sunrise'
import GiftIcon from '~icons/fluent-emoji-flat/wrapped-gift'

type Icon = ComponentType<SVGProps<SVGSVGElement>>

/** Bereiche des Elternbereichs; die Id ist zugleich der Pfad (`/parents/<id>`). */
export const PARENT_AREAS = [
  'review',
  'family',
  'tasks',
  'routines',
  'rewards',
  'connections',
  'settings',
] as const
export type ParentArea = (typeof PARENT_AREAS)[number]

/** Ohne Bereich in der Adresse: Kontrolle und Punkte, das braucht man im Alltag am häufigsten. */
export const DEFAULT_AREA: ParentArea = 'review'

/** Am Handy direkt in der unteren Leiste, der Rest steckt hinter „Mehr“. */
export const PRIMARY_AREAS: readonly ParentArea[] = ['review', 'tasks', 'routines', 'rewards']

export const AREA_ICONS: Record<ParentArea, Icon> = {
  review: CheckIcon,
  family: FamilyIcon,
  tasks: StarIcon,
  routines: SunriseIcon,
  rewards: GiftIcon,
  connections: CalendarIcon,
  settings: GearIcon,
}

export const isParentArea = (value: string | undefined): value is ParentArea =>
  PARENT_AREAS.includes(value as ParentArea)

export const areaPath = (area: ParentArea) => `/parents/${area}`
