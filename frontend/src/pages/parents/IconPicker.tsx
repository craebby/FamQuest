import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import SearchIcon from '~icons/lucide/search'
import CloseIcon from '~icons/lucide/x'

import { TaskIcon } from '../../components/TaskIcon'
import { Button } from '../../components/ui'
import { ICON_CATEGORIES, iconId, iconLabel, iconName, searchIcons } from '../../icons/catalog'

interface IconPickerProps {
  value: string
  onSelect: (icon: string) => void
  onClose: () => void
}

/** Auswahl aus dem Icon-Katalog: Kategorien zum Stöbern, Suche auf Deutsch und Englisch. */
export function IconPicker({ value, onSelect, onClose }: IconPickerProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState(ICON_CATEGORIES[0].id)
  const dialog = useRef<HTMLDivElement>(null)
  const selected = iconName(value)

  useEffect(() => {
    // Kein Autofokus auf die Suche: Am Touchscreen würde sonst sofort die Tastatur aufgehen.
    dialog.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const searching = query.trim().length > 0
  const icons = searching
    ? searchIcons(query)
    : (ICON_CATEGORIES.find((entry) => entry.id === category)?.icons ?? [])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="icon-picker-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-2 sm:p-4"
    >
      <div
        ref={dialog}
        tabIndex={-1}
        className="flex h-full max-h-[48rem] w-full max-w-4xl flex-col gap-4 overflow-hidden rounded-3xl bg-white p-4 outline-none sm:p-6"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="icon-picker-title" className="text-2xl font-extrabold text-slate-800">
            {t('icon_picker.title')}
          </h2>
          <Button variant="secondary" onClick={onClose} aria-label={t('icon_picker.close')}>
            <CloseIcon className="size-7" aria-hidden="true" />
          </Button>
        </div>

        <label className="flex min-h-14 items-center gap-3 rounded-2xl border-2 border-slate-200 px-4 focus-within:border-orange-400">
          <SearchIcon className="size-6 shrink-0 text-slate-500" aria-hidden="true" />
          <span className="sr-only">{t('icon_picker.search')}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('icon_picker.search_placeholder')}
            className="min-w-0 flex-1 bg-transparent text-lg outline-none"
            autoComplete="off"
          />
        </label>

        {!searching && (
          <div
            role="group"
            aria-label={t('icon_picker.categories')}
            className="-mx-1 flex shrink-0 gap-2 overflow-x-auto px-1 pb-1"
          >
            {ICON_CATEGORIES.map((entry) => (
              <button
                key={entry.id}
                type="button"
                aria-pressed={entry.id === category}
                onClick={() => setCategory(entry.id)}
                className="flex min-h-12 shrink-0 items-center gap-2 rounded-full px-4 text-base font-bold whitespace-nowrap text-slate-700 ring-2 ring-slate-200 focus-visible:outline-4 focus-visible:outline-orange-400 aria-pressed:bg-orange-500 aria-pressed:text-white aria-pressed:ring-orange-500"
              >
                <TaskIcon icon={iconId(entry.icons[0])} className="size-7" />
                {t(`icon_categories.${entry.id}`)}
              </button>
            ))}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {icons.length === 0 ? (
            <p className="p-4 text-center text-lg text-slate-600">{t('icon_picker.no_results')}</p>
          ) : (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2 p-1">
              {icons.map((name) => {
                const label = iconLabel(t, name)
                return (
                  <li key={name}>
                    <button
                      type="button"
                      aria-pressed={name === selected}
                      aria-label={label}
                      title={label}
                      onClick={() => onSelect(iconId(name))}
                      className="flex aspect-square w-full items-center justify-center rounded-2xl transition-colors hover:bg-orange-50 focus-visible:outline-4 focus-visible:outline-orange-400 active:bg-orange-100 aria-pressed:bg-orange-100 aria-pressed:ring-4 aria-pressed:ring-orange-500"
                    >
                      <TaskIcon icon={iconId(name)} className="size-14" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
