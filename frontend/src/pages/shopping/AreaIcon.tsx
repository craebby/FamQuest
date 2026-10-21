import BreadIcon from '~icons/fluent-emoji-flat/bread'
import CannedFoodIcon from '~icons/fluent-emoji-flat/canned-food'
import ChocolateIcon from '~icons/fluent-emoji-flat/chocolate-bar'
import CupIcon from '~icons/fluent-emoji-flat/cup-with-straw'
import IceIcon from '~icons/fluent-emoji-flat/ice'
import LotionIcon from '~icons/fluent-emoji-flat/lotion-bottle'
import MilkIcon from '~icons/fluent-emoji-flat/glass-of-milk'
import PackageIcon from '~icons/fluent-emoji-flat/package'
import AppleIcon from '~icons/fluent-emoji-flat/red-apple'
import BasketIcon from '~icons/fluent-emoji-flat/basket'
import BagsIcon from '~icons/fluent-emoji-flat/shopping-bags'
import CartIcon from '~icons/fluent-emoji-flat/shopping-cart'
import ToolboxIcon from '~icons/fluent-emoji-flat/toolbox'

import type { Area, Store } from './areas'

/** Ein Symbol je Laden und Bereich, damit auch Kinder die Abschnitte der Liste erkennen. */
const ICONS: Record<Area | Store, typeof CartIcon> = {
  supermarket: CartIcon,
  produce: AppleIcon,
  bakery: BreadIcon,
  pantry: CannedFoodIcon,
  sweets: ChocolateIcon,
  drinks: CupIcon,
  household: BasketIcon,
  chilled: MilkIcon,
  frozen: IceIcon,
  other: BagsIcon,
  drugstore: LotionIcon,
  hardware: ToolboxIcon,
  online: PackageIcon,
}

export function AreaIcon({ area, className }: { area: Area | Store; className: string }) {
  const Icon = ICONS[area]
  return <Icon className={`shrink-0 ${className}`} aria-hidden="true" />
}
