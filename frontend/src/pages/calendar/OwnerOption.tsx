import type { ReactNode } from 'react'

/** Auswahl einer Person oder der Familie: Avatar und Name als Radio-Knopf. */
export function OwnerOption({
  name,
  label,
  checked,
  disabled = false,
  onSelect,
  children,
}: {
  name: string
  label: string
  checked: boolean
  disabled?: boolean
  onSelect: () => void
  children: ReactNode
}) {
  return (
    <label className="cursor-pointer has-disabled:cursor-not-allowed">
      <input
        type="radio"
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
        className="peer sr-only"
      />
      <span className="flex min-h-12 items-center gap-2 rounded-full bg-slate-50 py-1 pr-4 pl-1 text-base font-bold text-slate-700 ring-2 ring-slate-200 peer-checked:bg-orange-50 peer-checked:ring-4 peer-checked:ring-slate-800 peer-focus-visible:outline-4 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-orange-400">
        {children}
        {label}
      </span>
    </label>
  )
}
