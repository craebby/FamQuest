import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { MEALS, MEAL_SETTINGS_KEY, useMealSettings, useSaveMealSettings } from '../../api/meals'
import { Alert, Section, Switch } from '../../components/ui'
import { errorMessage } from '../../errors'
import { MEAL_ICONS } from '../meals/mealIcons'

/** Welche Mahlzeiten der Essensplan zeigt; gilt für die ganze Familie, jede Änderung sofort. */
export function MealSettingsSection() {
  const { t } = useTranslation()
  const settings = useMealSettings()
  const save = useSaveMealSettings()
  const queryClient = useQueryClient()
  const meals = settings.data?.meals

  const toggle = (meal: (typeof MEALS)[number], on: boolean) => {
    if (!meals) return
    const next = { meals: MEALS.filter((entry) => (entry === meal ? on : meals.includes(entry))) }
    // Sofort anzeigen; die Antwort des Servers überschreibt es danach.
    queryClient.setQueryData(MEAL_SETTINGS_KEY, next)
    save.mutate(next)
  }

  return (
    <Section title={t('meals.settings')}>
      <p className="-mt-1 text-base text-slate-500">{t('meals.settings_hint')}</p>
      {settings.error ? <Alert>{errorMessage(t, settings.error)}</Alert> : null}
      {save.error ? <Alert>{errorMessage(t, save.error)}</Alert> : null}
      {meals && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {MEALS.map((meal) => {
            const Icon = MEAL_ICONS[meal]
            const on = meals.includes(meal)
            return (
              <li key={meal} className="flex items-center gap-3">
                <Icon className="size-8 shrink-0" aria-hidden="true" />
                <Switch
                  checked={on}
                  // Eine Mahlzeit bleibt immer, sonst gäbe es nichts zu planen.
                  disabled={on && meals.length === 1}
                  onChange={(checked) => toggle(meal, checked)}
                  label={t(`meals.meal.${meal}`)}
                  showLabel
                />
              </li>
            )
          })}
        </ul>
      )}
    </Section>
  )
}
