import { type ReactNode, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import DeleteIcon from '~icons/lucide/delete'
import CheckIcon from '~icons/fluent-emoji-flat/check-mark-button'

import { PIN_MAX_LENGTH, PIN_MIN_LENGTH } from '../validation'

interface PinPadProps {
  title: ReactNode
  onSubmit: (pin: string) => void
  error?: string
  busy?: boolean
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

/** Großes Ziffernfeld für die Eltern-PIN (Touch und Tastatur). */
export function PinPad({ title, onSubmit, error, busy = false }: PinPadProps) {
  const { t } = useTranslation()
  const [pin, setPin] = useState('')
  const canSubmit = pin.length >= PIN_MIN_LENGTH && !busy

  const add = (digit: string) =>
    setPin((current) => (current.length < PIN_MAX_LENGTH ? current + digit : current))
  const remove = () => setPin((current) => current.slice(0, -1))
  const submit = () => {
    if (!canSubmit) return
    onSubmit(pin)
    setPin('')
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return
      if (/^\d$/.test(event.key)) add(event.key)
      else if (event.key === 'Backspace') remove()
      else if (event.key === 'Enter') submit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const key =
    'flex aspect-square items-center justify-center rounded-3xl text-3xl font-bold transition-colors focus-visible:outline-4 focus-visible:outline-orange-400 disabled:opacity-40'

  return (
    <div className="flex flex-col items-center gap-4">
      <h2 className="text-2xl font-extrabold text-slate-800">{title}</h2>
      <div
        className="flex h-8 items-center gap-3"
        role="img"
        aria-label={t('pinpad.entered', { count: pin.length })}
      >
        {Array.from({ length: Math.max(PIN_MIN_LENGTH, pin.length) }, (_, index) => (
          <span
            key={index}
            className={`size-5 rounded-full transition-colors ${index < pin.length ? 'bg-orange-500' : 'bg-slate-200'}`}
          />
        ))}
      </div>
      {error && (
        <p role="alert" className="text-lg font-semibold text-red-700">
          {error}
        </p>
      )}
      {/* Tasten richten sich auch nach der Höhe, damit alles ohne Scrollen passt. */}
      <div className="grid w-full max-w-[min(18rem,38dvh)] grid-cols-3 gap-2">
        {DIGITS.map((digit) => (
          <button
            key={digit}
            type="button"
            className={`${key} bg-slate-100 text-slate-800 hover:bg-slate-200 active:bg-orange-200`}
            onClick={() => add(digit)}
            disabled={busy}
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          className={`${key} text-slate-600 hover:bg-slate-100`}
          onClick={remove}
          disabled={busy || pin.length === 0}
          aria-label={t('pinpad.delete')}
        >
          <DeleteIcon aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`${key} bg-slate-100 text-slate-800 hover:bg-slate-200 active:bg-orange-200`}
          onClick={() => add('0')}
          disabled={busy}
        >
          0
        </button>
        <button
          type="button"
          className={`${key} bg-orange-100 hover:bg-orange-200`}
          onClick={submit}
          disabled={!canSubmit}
          aria-label={t('pinpad.confirm')}
        >
          <CheckIcon className="size-12" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
