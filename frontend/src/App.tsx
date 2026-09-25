import { useTranslation } from 'react-i18next'

import { useHealth } from './api/health'

const STATUS_STYLES = {
  checking: 'bg-slate-100 text-slate-600',
  ok: 'bg-emerald-100 text-emerald-800',
  error: 'bg-red-100 text-red-800',
} as const

export default function App() {
  const { t } = useTranslation()
  const health = useHealth()

  const state = health.isPending ? 'checking' : health.data?.status === 'ok' ? 'ok' : 'error'

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-4 text-center">
      <span className="text-8xl" aria-hidden="true">
        ⭐
      </span>
      <h1 className="text-5xl font-extrabold tracking-tight text-orange-600">{t('app.name')}</h1>
      <p className="max-w-xl text-xl text-slate-600">{t('app.tagline')}</p>
      <p
        role="status"
        className={`flex items-center gap-3 rounded-full px-6 py-3 text-lg font-semibold ${STATUS_STYLES[state]}`}
      >
        <span className="size-3 rounded-full bg-current" aria-hidden="true" />
        {t(`health.${state}`)}
      </p>
    </main>
  )
}
