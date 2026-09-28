import { type CSSProperties, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import DownIcon from '~icons/fluent-emoji-flat/down-arrow'
import EyeIcon from '~icons/fluent-emoji-flat/eye'
import LockedIcon from '~icons/fluent-emoji-flat/locked'
import UpIcon from '~icons/fluent-emoji-flat/up-arrow'

import { useUnlockParent } from '../../api/auth'
import type { Tile } from '../../api/home'
import { PinPad } from '../../components/PinPad'
import { Alert, Button } from '../../components/ui'
import { errorMessage } from '../../errors'
import { TILES } from './tileMeta'

/** PIN-Abfrage über der Startseite, bevor die Eltern den Aufbau ändern. */
export function PinDialog({
  onUnlocked,
  onCancel,
}: {
  onUnlocked: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const unlock = useUnlockParent()

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('home.customize')}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4"
      onClick={onCancel}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-full w-full max-w-md flex-col gap-4 overflow-y-auto rounded-3xl bg-white p-6 shadow-xl"
      >
        <LockedIcon className="mx-auto size-12" aria-hidden="true" />
        <PinPad
          title={t('parents.pin_prompt')}
          onSubmit={(pin) => unlock.mutate(pin, { onSuccess: onUnlocked })}
          error={unlock.isError ? errorMessage(t, unlock.error) : undefined}
          busy={unlock.isPending}
        />
        <Button variant="secondary" onClick={onCancel}>
          {t('actions.cancel')}
        </Button>
      </div>
    </div>
  )
}

/**
 * Aufbau der Startseite bearbeiten: Kacheln ein- und ausblenden und verschieben. Darunter zeigt
 * die Seite sofort, wie es aussieht; gespeichert wird erst mit „Speichern“.
 */
export function HomeEditor({
  tiles,
  onChange,
  onSave,
  onReset,
  onCancel,
  busy,
  error,
}: {
  tiles: Tile[]
  onChange: (tiles: Tile[]) => void
  onSave: () => void
  onReset: () => void
  onCancel: () => void
  busy: boolean
  error: unknown
}) {
  const { t } = useTranslation()

  const move = (index: number, by: -1 | 1) => {
    const next = [...tiles]
    ;[next[index], next[index + by]] = [next[index + by], next[index]]
    onChange(next)
  }
  const toggle = (index: number) =>
    onChange(tiles.map((tile, i) => (i === index ? { ...tile, visible: !tile.visible } : tile)))

  return (
    <section
      aria-labelledby="home-editor-title"
      className="flex flex-col gap-4 rounded-3xl bg-white p-4 shadow-md ring-4 ring-orange-300"
    >
      <h2 id="home-editor-title" className="text-2xl font-extrabold text-slate-800">
        {t('home.customize')}
      </h2>
      <p className="text-lg text-slate-600">{t('home.customize_hint')}</p>
      {error != null && <Alert>{errorMessage(t, error)}</Alert>}
      {/* Auf dem Wanddisplay zwei Spalten (erst links von oben nach unten, dann rechts), damit die
          Vorschau darunter sichtbar bleibt. */}
      <ol
        className="grid grid-cols-1 gap-2 lg:grid-flow-col lg:grid-cols-2 lg:grid-rows-(--editor-rows)"
        style={{ '--editor-rows': `repeat(${Math.ceil(tiles.length / 2)}, auto)` } as CSSProperties}
      >
        {tiles.map((tile, index) => {
          const { title, icon: Icon } = TILES[tile.id]
          const name = t(title)
          return (
            <li
              key={tile.id}
              className={`flex flex-wrap items-center gap-3 rounded-2xl p-2 ${tile.visible ? 'bg-orange-50' : 'bg-slate-100'}`}
            >
              <span className="flex min-w-40 flex-1 items-center gap-3">
                <Icon
                  className={`size-10 shrink-0 ${tile.visible ? '' : 'opacity-40 grayscale'}`}
                  aria-hidden="true"
                />
                <span
                  className={`min-w-0 flex-1 truncate text-xl font-bold ${tile.visible ? 'text-slate-800' : 'text-slate-400 line-through'}`}
                >
                  {name}
                </span>
              </span>
              <span className="ml-auto flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={tile.visible}
                  aria-label={t('home.tile_visible', { name })}
                  title={t('home.tile_visible', { name })}
                  onClick={() => toggle(index)}
                  className={`flex h-14 w-24 shrink-0 items-center rounded-full p-1 transition-colors focus-visible:outline-4 focus-visible:outline-orange-400 ${tile.visible ? 'justify-end bg-emerald-500' : 'justify-start bg-slate-300'}`}
                >
                  <span className="flex size-12 items-center justify-center rounded-full bg-white shadow">
                    <EyeIcon
                      className={`size-8 ${tile.visible ? '' : 'opacity-30 grayscale'}`}
                      aria-hidden="true"
                    />
                  </span>
                </button>
                <MoveButton
                  label={t('home.move_up', { name })}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  icon={UpIcon}
                />
                <MoveButton
                  label={t('home.move_down', { name })}
                  disabled={index === tiles.length - 1}
                  onClick={() => move(index, 1)}
                  icon={DownIcon}
                />
              </span>
            </li>
          )
        })}
      </ol>
      <div className="flex flex-wrap gap-3">
        <Button onClick={onSave} disabled={busy}>
          {t('actions.save')}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          {t('actions.cancel')}
        </Button>
        <Button variant="secondary" onClick={onReset} disabled={busy} className="sm:ml-auto">
          {t('home.reset_layout')}
        </Button>
      </div>
    </section>
  )
}

function MoveButton({
  label,
  disabled,
  onClick,
  icon: Icon,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  icon: typeof UpIcon
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm hover:bg-orange-100 focus-visible:outline-4 focus-visible:outline-orange-400 disabled:opacity-30"
    >
      <Icon className="size-8" aria-hidden="true" />
    </button>
  )
}
