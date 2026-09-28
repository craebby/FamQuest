import type { ComponentType, SVGProps } from 'react'
import WeekIcon from '~icons/fluent-emoji-flat/calendar'
import MealIcon from '~icons/fluent-emoji-flat/fork-and-knife-with-plate'
import StarIcon from '~icons/fluent-emoji-flat/glowing-star'
import CartIcon from '~icons/fluent-emoji-flat/shopping-cart'
import CalendarIcon from '~icons/fluent-emoji-flat/spiral-calendar'
import SunCloudIcon from '~icons/fluent-emoji-flat/sun-behind-cloud'

import type { TileId } from '../../api/home'

type Icon = ComponentType<SVGProps<SVGSVGElement>>

/** Titel (Übersetzungsschlüssel) und Symbol jeder Kachel, wie sie auch die Kachel selbst zeigt. */
export const TILES: Record<TileId, { title: string; icon: Icon }> = {
  weather: { title: 'home.weather', icon: SunCloudIcon },
  events: { title: 'home.events', icon: CalendarIcon },
  tasks: { title: 'home.tasks', icon: StarIcon },
  week: { title: 'home.week', icon: WeekIcon },
  meals: { title: 'home.meals', icon: MealIcon },
  shopping: { title: 'home.shopping', icon: CartIcon },
}
