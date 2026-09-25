import { useTranslation } from 'react-i18next'
import HouseIcon from '~icons/fluent-emoji-flat/house-with-garden'

import { Avatar } from './Avatar'

/** „Avatar“ der ganzen Familie, z. B. für Kalender und Termine, die allen gehören. */
export function FamilyAvatar({
  color,
  size,
  label,
}: {
  color: string
  size?: 'xs' | 'sm' | 'md'
  label?: string
}) {
  const { t } = useTranslation()
  return (
    <Avatar name={t('calendar.family')} color={color} size={size} label={label} icon={HouseIcon} />
  )
}
