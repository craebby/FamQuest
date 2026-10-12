import { useTranslation } from 'react-i18next'
import StarIcon from '~icons/fluent-emoji-flat/star'

/**
 * Bewertung mit fünf großen Sternen. Ein Tipp setzt die Zahl, ein Tipp auf den gesetzten Stern
 * nimmt die Bewertung zurück. Ohne `onChange` nur zur Anzeige.
 */
export function StarRating({
  value,
  onChange,
  size = 'size-10',
  disabled = false,
}: {
  value: number | null
  onChange?: (value: number | null) => void
  size?: string
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const stars = [1, 2, 3, 4, 5]
  const star = (count: number) => (
    <StarIcon
      className={`${size} ${value !== null && count <= value ? '' : 'opacity-25 grayscale'}`}
      aria-hidden="true"
    />
  )
  if (!onChange) {
    return (
      <span
        role="img"
        aria-label={value === null ? t('recipes.not_rated') : t('recipes.stars', { count: value })}
        className="flex shrink-0"
      >
        {stars.map((count) => (
          <span key={count}>{star(count)}</span>
        ))}
      </span>
    )
  }
  return (
    <div role="group" aria-label={t('recipes.rating')} className="flex shrink-0">
      {stars.map((count) => (
        <button
          key={count}
          type="button"
          disabled={disabled}
          aria-label={t('recipes.stars', { count })}
          aria-pressed={value === count}
          onClick={() => onChange(value === count ? null : count)}
          className="rounded-xl p-0.5 focus-visible:outline-4 focus-visible:outline-orange-400 active:scale-90 disabled:opacity-60 motion-reduce:active:scale-100"
        >
          {star(count)}
        </button>
      ))}
    </div>
  )
}
