import { useTranslation } from 'react-i18next'

import { useDemo } from '../api/auth'

/** In der öffentlichen Demo steht die Eltern-PIN direkt unter der PIN-Abfrage. */
export function DemoPinHint() {
  const { t } = useTranslation()
  const demo = useDemo()
  if (!demo) return null
  return (
    <p className="rounded-2xl bg-sky-100 px-4 py-3 text-lg font-bold text-sky-900">
      {t('demo.pin_hint', { pin: demo.pin })}
    </p>
  )
}
