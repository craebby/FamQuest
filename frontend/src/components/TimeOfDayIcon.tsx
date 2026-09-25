import MoonIcon from '~icons/fluent-emoji-flat/crescent-moon'
import SunIcon from '~icons/fluent-emoji-flat/sun'
import CloudSunIcon from '~icons/fluent-emoji-flat/sun-behind-cloud'
import SunriseIcon from '~icons/fluent-emoji-flat/sunrise'

import type { TimeOfDay } from '../api/tasks'

export const TIME_OF_DAY_ICONS: Record<TimeOfDay, typeof SunIcon> = {
  morning: SunriseIcon,
  midday: SunIcon,
  afternoon: CloudSunIcon,
  evening: MoonIcon,
}
