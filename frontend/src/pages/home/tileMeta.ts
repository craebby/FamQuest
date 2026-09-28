import type { ComponentType, SVGProps } from 'react'
import MealIcon from '~icons/fluent-emoji-flat/fork-and-knife-with-plate'
import StarIcon from '~icons/fluent-emoji-flat/glowing-star'
import CartIcon from '~icons/fluent-emoji-flat/shopping-cart'
import CalendarIcon from '~icons/fluent-emoji-flat/spiral-calendar'
import SunCloudIcon from '~icons/fluent-emoji-flat/sun-behind-cloud'

import type { TileId } from '../../api/home'

type Icon = ComponentType<SVGProps<SVGSVGElement>>

/** Name (Übersetzungsschlüssel) und Symbol jedes Bereichs der Startseite, für den Editor. */
export const TILES: Record<TileId, { title: string; icon: Icon }> = {
  weather: { title: 'home.weather', icon: SunCloudIcon },
  tasks: { title: 'home.routine', icon: StarIcon },
  shopping: { title: 'home.shopping', icon: CartIcon },
  events: { title: 'home.events', icon: CalendarIcon },
  meals: { title: 'home.meals', icon: MealIcon },
}
