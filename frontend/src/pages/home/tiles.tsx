import { useTranslation } from 'react-i18next'
import CartIcon from '~icons/fluent-emoji-flat/shopping-cart'

import type { TileId } from '../../api/home'
import { EventsWidget } from './EventsWidget'
import { MealsWidget } from './MealsWidget'
import { TasksWidget } from './TasksWidget'
import { WeatherWidget } from './WeatherWidget'
import { WeekWidget } from './WeekWidget'
import { ComingSoon } from './Widget'

export function TileView({ id }: { id: TileId }) {
  const { t } = useTranslation()
  switch (id) {
    case 'weather':
      return <WeatherWidget />
    case 'events':
      return <EventsWidget />
    case 'tasks':
      return <TasksWidget />
    case 'week':
      return <WeekWidget />
    case 'meals':
      return <MealsWidget />
    case 'shopping':
      return (
        <ComingSoon title={t('home.shopping')} icon={CartIcon} text={t('home.shopping_hint')} />
      )
  }
}
