import { useTranslation } from 'react-i18next'
import PartyIcon from '~icons/fluent-emoji-flat/party-popper'
import BeachIcon from '~icons/fluent-emoji-flat/beach-with-umbrella'

/** Feiertag oder Schulferien: dezent in Steingrau, mit Symbol statt Personenfarbe. */
export function HolidayChip({ kind, name }: { kind: 'public' | 'school'; name: string }) {
  const { t } = useTranslation()
  const Icon = kind === 'public' ? PartyIcon : BeachIcon
  return (
    <li
      className="flex items-center gap-2 rounded-xl bg-stone-100 px-2 py-1 text-base leading-tight font-semibold text-stone-600"
      data-testid="holiday"
    >
      <Icon className="size-6 shrink-0" aria-hidden="true" />
      <span className="min-w-0 break-words">
        <span className="sr-only">
          {t(kind === 'public' ? 'calendar.public_holiday' : 'calendar.school_holiday')}:{' '}
        </span>
        {name}
      </span>
    </li>
  )
}
