import AppleIcon from '~icons/fluent-emoji-flat/red-apple'
import MoonIcon from '~icons/fluent-emoji-flat/crescent-moon'
import SunIcon from '~icons/fluent-emoji-flat/sun'
import SunriseIcon from '~icons/fluent-emoji-flat/sunrise'

import type { Meal } from '../../api/meals'

/** Symbole der Mahlzeiten, passend zu den Tagesabschnitten der Aufgaben. */
export const MEAL_ICONS: Record<Meal, typeof SunIcon> = {
  breakfast: SunriseIcon,
  lunch: SunIcon,
  dinner: MoonIcon,
  snack: AppleIcon,
}
