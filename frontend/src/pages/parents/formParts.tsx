import type { ReactNode } from 'react'

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
