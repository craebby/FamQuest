import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import CartIcon from '~icons/fluent-emoji-flat/shopping-cart'
import PlusIcon from '~icons/lucide/plus'

import { useShoppingList } from '../../api/shopping'
import { TaskIcon } from '../../components/TaskIcon'
import { errorMessage } from '../../errors'
import { ShoppingAdder } from '../shopping/ShoppingAdder'
import { Widget } from './Widget'

/**
 * So viele offene Artikel zeigt die Kachel (zwei Zeilen mit je zwei), der Rest steht als
 * „+3 weitere“ dabei. Die Kachel bleibt so niedrig, dass die Woche darunter ihren Platz behält.
 */
export const WIDGET_MAX_ITEMS = 4

/**
 * Einkauf auf der Startseite: was gerade fehlt, als Symbole mit Namen. Das „+“ in der Kopfzeile
 * öffnet denselben Dialog wie die Einkaufsliste, damit am Kühlschrank schnell etwas dazukommt.
 */
export function ShoppingWidget() {
  const { t } = useTranslation()
  const list = useShoppingList()
  const [adding, setAdding] = useState(false)
  const open = list.data?.items.filter((item) => !item.checked) ?? []
  const shown = open.slice(0, WIDGET_MAX_ITEMS)

  return (
    <Widget
      title={t('home.shopping')}
      icon={CartIcon}
      more={{ to: '/shopping', label: t('shopping.open_list') }}
      action={
        <button
          type="button"
          aria-label={t('shopping.add_button')}
          title={t('shopping.add_button')}
          onClick={() => setAdding(true)}
          className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-slate-700 hover:bg-orange-100 focus-visible:outline-4 focus-visible:outline-orange-400"
        >
          <PlusIcon className="size-8" aria-hidden="true" />
        </button>
      }
    >
      {list.isPending ? (
        <p role="status" className="text-lg text-slate-500">
          {t('common.loading')}
        </p>
      ) : !list.data ? (
        <p className="text-lg text-slate-600">{errorMessage(t, list.error)}</p>
      ) : open.length === 0 ? (
        <p className="text-xl font-bold text-slate-600">{t('shopping.empty')}</p>
      ) : (
        <ul aria-label={t('shopping.title')} className="grid grid-cols-2 gap-2">
          {shown.map((item) => (
            <li
              key={item.id}
              className="flex min-w-0 items-center gap-2 rounded-2xl bg-orange-50 py-1 pr-3 pl-1"
            >
              <TaskIcon icon={item.icon} className="size-10" />
              <span
                title={item.note ? `${item.name} · ${item.note}` : item.name}
                className="min-w-0 truncate text-lg leading-tight font-bold text-slate-800"
              >
                {item.name}
                {item.note && <span className="font-normal text-slate-500"> · {item.note}</span>}
              </span>
            </li>
          ))}
          {open.length > shown.length && (
            <li className="col-span-2 px-2 text-lg font-bold text-slate-500">
              {t('shopping.more', { count: open.length - shown.length })}
            </li>
          )}
        </ul>
      )}
      {adding && <ShoppingAdder onClose={() => setAdding(false)} />}
    </Widget>
  )
}
