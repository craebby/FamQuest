import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import CartIcon from '~icons/fluent-emoji-flat/shopping-cart'
import CheckIcon from '~icons/fluent-emoji-flat/check-mark-button'
import ArrangeIcon from '~icons/lucide/arrow-up-down'
import ArrowDownIcon from '~icons/lucide/arrow-down'
import ArrowUpIcon from '~icons/lucide/arrow-up'
import CloudOffIcon from '~icons/lucide/cloud-off'
import DownloadIcon from '~icons/lucide/download'
import RefreshIcon from '~icons/lucide/refresh-cw'
import CloseIcon from '~icons/lucide/x'
import PlusIcon from '~icons/lucide/plus'

import {
  type ListItem,
  useCheckItem,
  useClearChecked,
  useEditEntry,
  useMoveItem,
  useOrderItems,
  usePendingShoppingCount,
  useRemoveFromList,
  useShoppingList,
} from '../api/shopping'
import { TaskIcon } from '../components/TaskIcon'
import { Alert, Button } from '../components/ui'
import { errorMessage } from '../errors'
import { useOnline } from '../offline'
import { useShopApp } from '../pwa'
import { AreaIcon } from './shopping/AreaIcon'
import { EntryEditor } from './shopping/EntryEditor'
import { MoveDialog } from './shopping/MoveDialog'
import { ShoppingAdder } from './shopping/ShoppingAdder'
import { type AreaGroup, type Store, groupItems, itemArea } from './shopping/areas'

/**
 * Einkaufsliste: offene Artikel groß mit Symbol, ein Tipp auf den Kreis hakt ab, ein weiterer nimmt
 * es zurück; ein Tipp auf den Artikel öffnet ihn zum Ändern (Tippfehler). Abgehakte stehen darunter
 * bis zum Ende des Tages. Eintragen geht ohne Eltern-PIN.
 * Ohne Netz (im Laden) geht alles weiter; die Änderungen werden später gesendet.
 * Offene Artikel stehen nach Laden und Bereich im Supermarkt (Laufweg); „Ordnen“ ändert die
 * Reihenfolge im Bereich und verschiebt in einen anderen Bereich.
 * `installable`: als App fürs Handy anbieten (nicht am Display und in der Küchenansicht).
 */
export function ShoppingPage({ installable = false }: { installable?: boolean }) {
  const { t } = useTranslation()
  const list = useShoppingList()
  const check = useCheckItem()
  const remove = useRemoveFromList()
  const clear = useClearChecked()
  const move = useMoveItem()
  const order = useOrderItems()
  const edit = useEditEntry()
  const [adding, setAdding] = useState(false)
  const [arranging, setArranging] = useState(false)
  const [moving, setMoving] = useState<ListItem | null>(null)
  const [editing, setEditing] = useState<ListItem | null>(null)
  const items = list.data?.items ?? []
  const open = items.filter((item) => !item.checked)
  const checked = items.filter((item) => item.checked)
  const groups = groupItems(open)
  const supermarket = groups.find((group) => group.store === 'supermarket')
  const otherStores = groups.filter((group) => group.store !== 'supermarket')
  // Läden nur dann als Überschrift, wenn nicht alles aus dem Supermarkt kommt.
  const showStores = groups.length > 1 || groups[0]?.store !== 'supermarket'
  const error =
    check.error ?? remove.error ?? clear.error ?? move.error ?? order.error ?? edit.error

  const toggle = (item: ListItem) =>
    check.mutate({ id: item.id, name: item.name, checked: !item.checked })

  const rows = (group: AreaGroup) => (
    <ul className="flex flex-col gap-2">
      {group.items.map((item, index) =>
        arranging ? (
          <ArrangeRow
            key={item.id}
            item={item}
            first={index === 0}
            last={index === group.items.length - 1}
            onUp={() => shift(group, index, -1)}
            onDown={() => shift(group, index, 1)}
            onMove={() => setMoving(item)}
          />
        ) : (
          <Row
            key={item.id}
            item={item}
            onToggle={() => toggle(item)}
            onEdit={() => setEditing(item)}
          >
            <button
              type="button"
              aria-label={t('shopping.remove', { name: item.name })}
              title={t('shopping.remove', { name: item.name })}
              onClick={() => remove.mutate({ id: item.id, name: item.name })}
              className="flex w-14 shrink-0 items-center justify-center rounded-2xl text-slate-400 hover:bg-red-50 hover:text-red-700 focus-visible:outline-4 focus-visible:outline-orange-400"
            >
              <CloseIcon className="size-7" aria-hidden="true" />
            </button>
          </Row>
        ),
      )}
    </ul>
  )

  /** Tauscht den Artikel mit seinem Nachbarn im Bereich (`step` -1 nach oben, 1 nach unten). */
  const shift = (group: AreaGroup, index: number, step: -1 | 1) => {
    const next = [...group.items]
    ;[next[index], next[index + step]] = [next[index + step], next[index]]
    order.mutate({ items: next.map(({ id, name }) => ({ id, name })) })
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-extrabold text-orange-600">{t('shopping.title')}</h1>
        <SyncStatus />
        {installable && <InstallApp />}
        <div className="ml-auto flex flex-wrap gap-3">
          {arranging ? (
            <Button onClick={() => setArranging(false)}>{t('shopping.arrange_done')}</Button>
          ) : (
            <>
              {open.length > 0 && (
                <Button variant="secondary" onClick={() => setArranging(true)}>
                  <ArrangeIcon className="size-6" aria-hidden="true" />
                  {t('shopping.arrange')}
                </Button>
              )}
              <Button onClick={() => setAdding(true)}>
                <PlusIcon className="size-7" aria-hidden="true" />
                {t('shopping.add_button')}
              </Button>
            </>
          )}
        </div>
      </header>

      {arranging && <p className="text-lg text-slate-600">{t('shopping.arrange_hint')}</p>}

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
            <div className="flex flex-col gap-4">
              {supermarket && (
                <section
                  aria-label={t('shopping.store.supermarket')}
                  className="flex flex-col gap-3"
                >
                  {showStores && <StoreHeading store="supermarket" />}
                  {/* Bereiche fließen in Spalten: am Display nebeneinander, am Handy untereinander. */}
                  <div className="columns-[18rem] gap-3">
                    {supermarket.areas.map((group) => (
                      <section
                        key={group.area}
                        aria-label={t(`shopping.area.${group.area}`)}
                        className="mb-4 flex break-inside-avoid flex-col gap-2"
                      >
                        {!(supermarket.areas.length === 1 && group.area === 'other') && (
                          <h3 className="flex items-center gap-2 text-xl font-extrabold text-slate-500">
                            <AreaIcon area={group.area} className="size-8" />
                            {t(`shopping.area.${group.area}`)}
                          </h3>
                        )}
                        {rows(group)}
                      </section>
                    ))}
                  </div>
                </section>
              )}
              {/* Die anderen Läden haben je einen Bereich und stehen nebeneinander. */}
              {otherStores.length > 0 && (
                <div className="columns-[18rem] gap-3">
                  {otherStores.map(({ store, areas }) => (
                    <section
                      key={store}
                      aria-label={t(`shopping.store.${store}`)}
                      className="mb-4 flex break-inside-avoid flex-col gap-3"
                    >
                      <StoreHeading store={store} />
                      {areas.map((group) => (
                        <div key={group.area}>{rows(group)}</div>
                      ))}
                    </section>
                  ))}
                </div>
              )}
            </div>
          )}

          {!arranging && checked.length > 0 && (
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
                  <Row
                    key={item.id}
                    item={item}
                    onToggle={() => toggle(item)}
                    onEdit={() => setEditing(item)}
                  />
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {adding && <ShoppingAdder onClose={() => setAdding(false)} />}
      {editing && (
        <EntryEditor
          item={editing}
          onSave={({ name, icon, note }) => {
            edit.mutate({ id: editing.id, name: editing.name, newName: name, icon, note })
            setEditing(null)
          }}
          onMove={
            editing.checked
              ? undefined
              : () => {
                  setMoving(editing)
                  setEditing(null)
                }
          }
          onRemove={() => {
            remove.mutate({ id: editing.id, name: editing.name })
            setEditing(null)
          }}
          onClose={() => setEditing(null)}
        />
      )}
      {moving && (
        <MoveDialog
          item={moving}
          onMove={(area) => {
            move.mutate({ id: moving.id, name: moving.name, area })
            setMoving(null)
          }}
          onClose={() => setMoving(null)}
        />
      )}
    </main>
  )
}

/**
 * Ein Artikel als große Zeile. Der Kreis links hakt ab und zeigt, ob er schon im Wagen ist; ein
 * Tipp auf den Artikel selbst öffnet ihn zum Ändern.
 */
function Row({
  item,
  onToggle,
  onEdit,
  children,
}: {
  item: ListItem
  onToggle: () => void
  onEdit: () => void
  children?: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <li
      className={`flex min-w-0 items-stretch gap-1 rounded-2xl bg-white p-1 shadow-sm ${item.checked ? 'opacity-60' : ''}`}
    >
      <button
        type="button"
        aria-pressed={item.checked}
        aria-label={t('shopping.check', { name: item.name })}
        title={t('shopping.check', { name: item.name })}
        onClick={onToggle}
        className="flex min-h-20 w-16 shrink-0 items-center justify-center rounded-xl hover:bg-orange-50 focus-visible:outline-4 focus-visible:outline-orange-400 active:bg-orange-100"
      >
        {item.checked ? (
          <CheckIcon className="size-11" aria-hidden="true" />
        ) : (
          <span
            aria-hidden="true"
            className="size-11 rounded-full bg-white ring-4 ring-slate-300"
          />
        )}
      </button>
      <button
        type="button"
        onClick={onEdit}
        className="flex min-h-20 min-w-0 flex-1 items-center gap-3 rounded-xl p-2 text-left hover:bg-orange-50 focus-visible:outline-4 focus-visible:outline-orange-400 active:bg-orange-100"
      >
        <TaskIcon icon={item.icon} className="size-14" />
        <span className="flex min-w-0 flex-col">
          <span
            className={`text-2xl leading-tight font-bold break-words hyphens-auto text-slate-800 ${item.checked ? 'line-through' : ''}`}
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

function StoreHeading({ store }: { store: Store }) {
  const { t } = useTranslation()
  return (
    <h2 className="flex items-center gap-3 text-2xl font-extrabold text-slate-700">
      <AreaIcon area={store} className="size-10" />
      {t(`shopping.store.${store}`)}
    </h2>
  )
}

/** Ein Artikel beim Ordnen: Pfeile für die Reihenfolge, der Laden-Knopf zum Verschieben. */
function ArrangeRow({
  item,
  first,
  last,
  onUp,
  onDown,
  onMove,
}: {
  item: ListItem
  first: boolean
  last: boolean
  onUp: () => void
  onDown: () => void
  onMove: () => void
}) {
  const { t } = useTranslation()
  const button =
    'flex size-14 shrink-0 items-center justify-center rounded-xl text-slate-600 ring-2 ring-slate-200 hover:bg-orange-50 focus-visible:outline-4 focus-visible:outline-orange-400 active:bg-orange-100 disabled:opacity-30'
  return (
    <li className="flex min-w-0 items-center gap-2 rounded-2xl bg-white p-2 shadow-sm">
      <TaskIcon icon={item.icon} className="size-10" />
      <span className="min-w-0 flex-1 text-xl leading-tight font-bold break-words hyphens-auto text-slate-800">
        {item.name}
      </span>
      <button
        type="button"
        aria-label={t('shopping.move_up', { name: item.name })}
        title={t('shopping.move_up', { name: item.name })}
        disabled={first}
        onClick={onUp}
        className={button}
      >
        <ArrowUpIcon className="size-7" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label={t('shopping.move_down', { name: item.name })}
        title={t('shopping.move_down', { name: item.name })}
        disabled={last}
        onClick={onDown}
        className={button}
      >
        <ArrowDownIcon className="size-7" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label={t('shopping.move', { name: item.name })}
        title={t('shopping.move', { name: item.name })}
        onClick={onMove}
        className={button}
      >
        <AreaIcon area={itemArea(item)} className="size-9" />
      </button>
    </li>
  )
}

/** Zeigt, wenn das Handy offline ist oder Änderungen noch nicht beim Server sind. */
function SyncStatus() {
  const { t } = useTranslation()
  const online = useOnline()
  const pending = usePendingShoppingCount()
  if (online && pending === 0) return null
  const Icon = online ? RefreshIcon : CloudOffIcon
  const text = [
    online ? null : t('shopping.status_offline'),
    pending === 0
      ? null
      : online
        ? t('shopping.status_sending')
        : t('shopping.status_pending', { count: pending }),
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <p
      role="status"
      title={t('shopping.status_hint')}
      className="flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-base font-bold text-amber-900"
    >
      <Icon className="size-5 shrink-0" aria-hidden="true" />
      {text}
    </p>
  )
}

/**
 * Bietet am Handy an, die Liste als App zu installieren (Android per Knopf, iPhone mit Hinweis).
 * Meldet dafür Manifest und Service Worker an, auch wenn kein Knopf zu sehen ist.
 */
function InstallApp() {
  const { t } = useTranslation()
  const { install, iosHint } = useShopApp()
  const [showHint, setShowHint] = useState(false)
  if (!install && !iosHint) return null
  return (
    <>
      <Button
        variant="secondary"
        className="sm:hidden"
        onClick={() => (install ? void install() : setShowHint((shown) => !shown))}
      >
        <DownloadIcon className="size-6" aria-hidden="true" />
        {t('shopping.install')}
      </Button>
      {showHint && (
        <p className="w-full rounded-2xl bg-white px-4 py-3 text-lg text-slate-700 sm:hidden">
          {t('shopping.install_ios')}
        </p>
      )}
    </>
  )
}
