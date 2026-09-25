import type { ReactNode } from 'react'
import MinusIcon from '~icons/lucide/minus'
import PlusIcon from '~icons/lucide/plus'

import { Button } from '../../components/ui'

/** Beschriftete Gruppe von Eingaben im Elternbereich. */
export function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: ReactNode
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1.5 text-base font-bold text-slate-700">{label}</legend>
      {children}
      {error && <p className="text-base font-semibold text-red-700">{error}</p>}
    </fieldset>
  )
}

/** Große Auswahlkachel (Radio-Button) mit Symbol und Text. */
export function ChoiceTile({
  name,
  checked,
  onChange,
  children,
}: {
  name: string
  checked: boolean
  onChange: () => void
  children: ReactNode
}) {
  return (
    <label className="cursor-pointer">
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="peer sr-only"
      />
      <span className="flex h-full min-h-24 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-slate-200 p-3 text-center text-lg font-bold text-slate-700 peer-checked:border-orange-500 peer-checked:bg-orange-50 peer-focus-visible:outline-4 peer-focus-visible:outline-orange-400">
        {children}
      </span>
    </label>
  )
}

/** Zahl mit großen −/+-Knöpfen; Eingaben außerhalb von `min`–`max` werden begrenzt. */
export function NumberStepper({
  label,
  value,
  min,
  max,
  onChange,
  decreaseLabel,
  increaseLabel,
  icon,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  decreaseLabel: string
  increaseLabel: string
  icon?: ReactNode
}) {
  const set = (next: number) =>
    onChange(Math.min(max, Math.max(min, Number.isFinite(next) ? next : min)))
  return (
    <div className="flex items-center gap-3">
      <Button
        variant="secondary"
        aria-label={decreaseLabel}
        disabled={value <= min}
        onClick={() => set(value - 1)}
      >
        <MinusIcon className="size-7" aria-hidden="true" />
      </Button>
      <label className="flex min-h-14 items-center gap-2 rounded-2xl border-2 border-slate-200 px-4 focus-within:border-orange-400">
        {icon}
        <span className="sr-only">{label}</span>
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          onChange={(event) => set(Math.trunc(Number(event.target.value)))}
          className="w-20 bg-transparent text-center text-2xl font-extrabold outline-none"
        />
      </label>
      <Button
        variant="secondary"
        aria-label={increaseLabel}
        disabled={value >= max}
        onClick={() => set(value + 1)}
      >
        <PlusIcon className="size-7" aria-hidden="true" />
      </Button>
    </div>
  )
}

/** Umschaltbarer Filter-Chip, z. B. für die Auswahl einer Person. */
export function FilterChip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className="flex min-h-14 shrink-0 items-center gap-2 rounded-full py-1 pr-5 pl-1 text-lg font-bold whitespace-nowrap text-slate-700 ring-2 ring-slate-200 first:pl-5 focus-visible:outline-4 focus-visible:outline-orange-400 aria-pressed:bg-orange-500 aria-pressed:text-white aria-pressed:ring-orange-500"
    >
      {children}
    </button>
  )
}
