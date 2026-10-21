import { ShoppingPage } from './ShoppingPage'

/**
 * Die Einkaufsliste als App fürs Handy (vom Startbildschirm aus): nur die Liste, ohne
 * Navigationsleiste, damit im Laden ohne Netz nichts auf Seiten führt, die dann nicht laden.
 */
export function ShopPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <ShoppingPage installable />
    </div>
  )
}
