import { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, useId } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'danger'

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-orange-500 text-white hover:bg-orange-600 active:bg-orange-700',
  secondary: 'bg-white text-slate-700 ring-2 ring-slate-200 hover:bg-slate-50 active:bg-slate-100',
  danger: 'bg-white text-red-700 ring-2 ring-red-200 hover:bg-red-50 active:bg-red-100',
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl px-6 py-3 text-lg font-bold transition-colors focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-orange-400 disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_VARIANTS[variant]} ${className}`}
      {...props}
    />
  )
}

export function TextField({
  label,
  error,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <div className="flex flex-col gap-1.5 text-left">
      <label htmlFor={id} className="text-base font-bold text-slate-700">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`min-h-14 rounded-2xl border-2 bg-white px-4 text-lg outline-none focus:border-orange-400 ${error ? 'border-red-400' : 'border-slate-200'}`}
        {...props}
      />
      {error ? (
        <p id={`${id}-error`} className="text-base font-semibold text-red-700">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-base text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export function Alert({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-2xl bg-red-100 px-4 py-3 text-lg font-semibold text-red-800">
      {children}
    </p>
  )
}

/** Zentrierte Karte für Setup, Login und PIN-Eingabe. */
export function CenteredCard({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="flex w-full max-w-lg flex-col gap-6 rounded-3xl bg-white p-6 text-center shadow-xl shadow-orange-900/5 sm:p-10">
        {children}
      </div>
    </main>
  )
}

export function FullScreenMessage({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-4 text-center text-xl text-slate-600">
      {children}
    </main>
  )
}
