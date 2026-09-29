import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import CartIcon from '~icons/fluent-emoji-flat/shopping-cart'
import CheckIcon from '~icons/fluent-emoji-flat/check-mark-button'
import CloseIcon from '~icons/lucide/x'
import PlusIcon from '~icons/lucide/plus'

import {
  type ListItem,
  useCheckItem,
  useClearChecked,
  useRemoveFromList,
  useShoppingList,
} from '../api/shopping'
import { TaskIcon } from '../components/TaskIcon'
import { Alert, Button } from '../components/ui'
import { errorMessage } from '../errors'
import { ShoppingAdder } from './shopping/ShoppingAdder'

/**
 * Einkaufsliste: offene Artikel groß mit Symbol, ein Tipp hakt ab, ein weiterer nimmt es zurück.
 * Abgehakte stehen darunter bis zum Ende des Tages. Eintragen geht ohne Eltern-PIN.
 */
export function ShoppingPage() {
  const { t } = useTranslation()
  const list = useShoppingList()
  const check = useCheckItem()
  const remove = useRemoveFromList()
  const clear = useClearChecked()
  const [adding, setAdding] = useState(false)
  const items = list.data?.items ?? []
  const open = items.filter((item) => !item.checked)
  const checked = items.filter((item) => item.checked)
  const error = check.error ?? remove.error ?? clear.error

  const toggle = (item: ListItem) => check.mutate({ id: item.id, checked: !item.checked })

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-extrabold text-orange-600">{t('shopping.title')}</h1>
        <Button className="ml-auto" onClick={() => setAdding(true)}>
          <PlusIcon className="size-7" aria-hidden="true" />
          {t('shopping.add_button')}
        </Button>
      </header>

      {error ? <Alert>{errorMessage(t, error)}</Alert> : null}

      {list.isPending ? (
        <p role="status" className="text-xl text-slate-600">
          {t('common.loading')}
        </p>
      ) : !list.data ? (
        <div className="flex flex-col items-start gap-4">
          <Alert>{errorMessage(t, list.error)}</Alert>
          <Button onClick={() => void list.refetch()}>{t('actions.retry')}</Button>
        </div>
      ) : (
        <>
          {open.length === 0 ? (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex flex-col items-center gap-3 rounded-3xl border-4 border-dashed border-slate-200 p-8 text-center hover:bg-white focus-visible:outline-4 focus-visible:outline-orange-400"
            >
              <CartIcon className="size-24" aria-hidden="true" />
              <span className="text-2xl font-extrabold text-slate-700">{t('shopping.empty')}</span>
              <span className="text-lg text-slate-500">{t('shopping.empty_hint')}</span>
            </button>
          ) : (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-3">
              {open.map((item) => (
                <Row key={item.id} item={item} onToggle={() => toggle(item)}>
                  <button
                    type="button"
                    aria-label={t('shopping.remove', { name: item.name })}
                    title={t('shopping.remove', { name: item.name })}
                    onClick={() => remove.mutate(item.id)}
                    className="flex w-14 shrink-0 items-center justify-center rounded-2xl text-slate-400 hover:bg-red-50 hover:text-red-700 focus-visible:outline-4 focus-visible:outline-orange-400"
                  >
                    <CloseIcon className="size-7" aria-hidden="true" />
                  </button>
                </Row>
              ))}
            </ul>
          )}

          {checked.length > 0 && (
            <section aria-labelledby="shopping-checked" className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <h2 id="shopping-checked" className="text-2xl font-extrabold text-slate-500">
                  {t('shopping.checked_title')}
                </h2>
                <Button
                  variant="secondary"
                  className="ml-auto"
                  disabled={clear.isPending}
                  onClick={() => clear.mutate()}
                >
                  {t('shopping.clear_checked')}
                </Button>
              </div>
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-3">
                {checked.map((item) => (
                  <Row key={item.id} item={item} onToggle={() => toggle(item)} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {adding && <ShoppingAdder onClose={() => setAdding(false)} />}
    </main>
  )
}

/** Ein Artikel als große Zeile; der Kreis links zeigt, ob er schon im Wagen ist. */
function Row({
  item,
  onToggle,
  children,
}: {
  item: ListItem
  onToggle: () => void
  children?: ReactNode
}) {
  return (
    <li
      className={`flex min-w-0 items-stretch gap-1 rounded-2xl bg-white p-1 shadow-sm ${item.checked ? 'opacity-60' : ''}`}
    >
      <button
        type="button"
        aria-pressed={item.checked}
        onClick={onToggle}
        className="flex min-h-20 min-w-0 flex-1 items-center gap-3 rounded-xl p-2 text-left hover:bg-orange-50 focus-visible:outline-4 focus-visible:outline-orange-400 active:bg-orange-100"
      >
        {item.checked ? (
          <CheckIcon className="size-10 shrink-0" aria-hidden="true" />
        ) : (
          <span
            aria-hidden="true"
            className="size-10 shrink-0 rounded-full bg-white ring-4 ring-slate-300"
          />
        )}
        <TaskIcon icon={item.icon} className="size-14" />
        <span className="flex min-w-0 flex-col">
          <span
            className={`text-2xl leading-tight font-bold break-words text-slate-800 ${item.checked ? 'line-through' : ''}`}
          >
            {item.name}
          </span>
          {item.note && (
            <span className="text-lg leading-tight break-words text-slate-500">{item.note}</span>
          )}
        </span>
      </button>
      {children}
    </li>
  )
}
