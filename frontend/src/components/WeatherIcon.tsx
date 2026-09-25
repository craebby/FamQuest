import type { ComponentType, SVGProps } from 'react'
import CloudIcon from '~icons/fluent-emoji-flat/cloud'
import RainIcon from '~icons/fluent-emoji-flat/cloud-with-rain'
import SnowIcon from '~icons/fluent-emoji-flat/cloud-with-snow'
import ThunderIcon from '~icons/fluent-emoji-flat/cloud-with-lightning-and-rain'
import MoonIcon from '~icons/fluent-emoji-flat/crescent-moon'
import FogIcon from '~icons/fluent-emoji-flat/fog'
import SunIcon from '~icons/fluent-emoji-flat/sun'
import SunCloudIcon from '~icons/fluent-emoji-flat/sun-behind-cloud'
import SunRainIcon from '~icons/fluent-emoji-flat/sun-behind-rain-cloud'
import SunSmallCloudIcon from '~icons/fluent-emoji-flat/sun-behind-small-cloud'

import { type WeatherKind, weatherKind } from '../weatherKinds'

type Icon = ComponentType<SVGProps<SVGSVGElement>>

const DAY: Record<WeatherKind, Icon> = {
  clear: SunIcon,
  mostly_clear: SunSmallCloudIcon,
  partly_cloudy: SunCloudIcon,
  cloudy: CloudIcon,
  fog: FogIcon,
  drizzle: RainIcon,
  rain: RainIcon,
  showers: SunRainIcon,
  snow: SnowIcon,
  thunder: ThunderIcon,
}

// Nachts kein Sonnen-Symbol.
const NIGHT: Partial<Record<WeatherKind, Icon>> = {
  clear: MoonIcon,
  mostly_clear: MoonIcon,
  partly_cloudy: CloudIcon,
  showers: RainIcon,
}

/** Symbol zu einem WMO-Wettercode; die Bedeutung trägt der umgebende Text. */
export function WeatherIcon({
  code,
  night = false,
  className,
}: {
  code: number
  night?: boolean
  className?: string
}) {
  const kind = weatherKind(code)
  const Icon = (night && NIGHT[kind]) || DAY[kind]
  return <Icon className={className} aria-hidden="true" />
}
