import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router'

import { mealieUrl, useMealie } from '../api/mealie'
import { MealieFrame } from './mealie/MealieFrame'

/** Mealie über den Knopf in der Navigationsleiste, z. B. für ein Rezept, das nicht verknüpft ist. */
export function MealiePage() {
  const { t } = useTranslation()
  const mealie = useMealie()
  const url = mealieUrl(mealie.data)
  if (mealie.isPending) {
    return (
      <p role="status" className="p-6 text-xl text-slate-600">
        {t('common.loading')}
      </p>
    )
  }
  if (!url) return <Navigate to="/meals" replace />
  return (
    <main className="flex h-[calc(100dvh-7rem)] flex-col p-2 sm:h-dvh sm:p-3">
      <h1 className="sr-only">{t('mealie.title')}</h1>
      <MealieFrame src={url} />
    </main>
  )
}
