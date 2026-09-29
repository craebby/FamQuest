import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import CartIcon from '~icons/fluent-emoji-flat/shopping-cart'
import PlusIcon from '~icons/lucide/plus'

import { useShoppingList } from '../../api/shopping'
import { TaskIcon } from '../../components/TaskIcon'
import { Button } from '../../components/ui'
import { errorMessage } from '../../errors'
import { ShoppingAdder } from '../shopping/ShoppingAdder'
import { Widget } from './Widget'

/** So viele offene Artikel zeigt die Kachel, der Rest steht als „+3 weitere“ dabei. */
export const WIDGET_MAX_ITEMS = 12

/**
 * Einkauf auf der Startseite: was gerade fehlt, als Symbole mit Namen. „Eintragen“ öffnet
 * denselben Dialog wie die Einkaufsliste, damit am Kühlschrank schnell etwas dazukommt.
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
        <ul aria-label={t('shopping.title')} className="flex flex-wrap gap-2">
          {shown.map((item) => (
            <li
              key={item.id}
              className="flex min-w-0 items-center gap-2 rounded-2xl bg-orange-50 py-1 pr-3 pl-1"
            >
              <TaskIcon icon={item.icon} className="size-10" />
              <span className="min-w-0 text-lg leading-tight font-bold break-words text-slate-800">
                {item.name}
                {item.note && <span className="font-normal text-slate-500"> · {item.note}</span>}
              </span>
            </li>
          ))}
          {open.length > shown.length && (
            <li className="flex items-center px-2 text-lg font-bold text-slate-500">
              {t('shopping.more', { count: open.length - shown.length })}
            </li>
          )}
        </ul>
      )}
      <Button variant="secondary" className="self-start" onClick={() => setAdding(true)}>
        <PlusIcon className="size-7" aria-hidden="true" />
        {t('shopping.add_button')}
      </Button>
      {adding && <ShoppingAdder onClose={() => setAdding(false)} />}
    </Widget>
  )
}
