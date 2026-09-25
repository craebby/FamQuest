import type { TFunction } from 'i18next'

import { iconId } from '../icons/catalog'

/** Größen der vorgeschlagenen Belohnungen, klein bis groß. */
export const REWARD_TIERS = ['small', 'medium', 'large'] as const
export type RewardTier = (typeof REWARD_TIERS)[number]

export interface RewardTemplate {
  /** Schlüssel für den Namen in locales/<sprache>/pool.json (`rewards.<id>`). */
  id: string
  /** Name im Icon-Katalog (src/icons/categories.json). */
  icon: string
  cost: number
  tier: RewardTier
}

/**
 * Vorgegebener Pool, aus dem Eltern Belohnungen für ein Kind auswählen.
 * Der Name wird beim Übernehmen in der aktuellen Sprache gespeichert und ist danach frei änderbar.
 */
export const REWARD_POOL: readonly RewardTemplate[] = [
  { id: 'sweet', icon: 'lollipop', cost: 5, tier: 'small' },
  { id: 'car_song', icon: 'musical-note', cost: 5, tier: 'small' },
  { id: 'ice_cream', icon: 'soft-ice-cream', cost: 10, tier: 'small' },
  { id: 'extra_story', icon: 'open-book', cost: 10, tier: 'small' },
  { id: 'cuddly_toy', icon: 'teddy-bear', cost: 10, tier: 'small' },
  { id: 'bubble_bath', icon: 'bathtub', cost: 10, tier: 'small' },
  { id: 'tv_15', icon: 'television', cost: 15, tier: 'small' },
  { id: 'play_15', icon: 'video-game', cost: 15, tier: 'small' },
  { id: 'tablet_15', icon: 'mobile-phone', cost: 15, tier: 'small' },
  { id: 'pick_show', icon: 'clapper-board', cost: 15, tier: 'small' },
  { id: 'stay_up', icon: 'crescent-moon', cost: 20, tier: 'small' },
  { id: 'breakfast', icon: 'pancakes', cost: 20, tier: 'medium' },
  { id: 'playground', icon: 'playground-slide', cost: 25, tier: 'medium' },
  { id: 'craft', icon: 'artist-palette', cost: 25, tier: 'medium' },
  { id: 'parent_game', icon: 'game-die', cost: 25, tier: 'medium' },
  { id: 'play_30', icon: 'video-game', cost: 30, tier: 'medium' },
  { id: 'screen_30', icon: 'television', cost: 30, tier: 'medium' },
  { id: 'favorite_meal', icon: 'shallow-pan-of-food', cost: 30, tier: 'medium' },
  { id: 'bake', icon: 'cupcake', cost: 30, tier: 'medium' },
  { id: 'bike_tour', icon: 'bicycle', cost: 30, tier: 'medium' },
  { id: 'new_book', icon: 'books', cost: 30, tier: 'medium' },
  { id: 'movie_night', icon: 'popcorn', cost: 40, tier: 'medium' },
  { id: 'day_out', icon: 'national-park', cost: 50, tier: 'large' },
  { id: 'ice_cafe', icon: 'ice-cream', cost: 50, tier: 'large' },
  { id: 'order_pizza', icon: 'pizza', cost: 60, tier: 'large' },
  { id: 'sleepover', icon: 'camping', cost: 60, tier: 'large' },
  { id: 'swimming', icon: 'person-swimming', cost: 75, tier: 'large' },
  { id: 'zoo', icon: 'giraffe', cost: 75, tier: 'large' },
  { id: 'cinema', icon: 'cinema', cost: 80, tier: 'large' },
  { id: 'small_toy', icon: 'kite', cost: 80, tier: 'large' },
  { id: 'theme_park', icon: 'roller-coaster', cost: 100, tier: 'large' },
  { id: 'day_trip', icon: 'locomotive', cost: 100, tier: 'large' },
  { id: 'family_day', icon: 'people-hugging', cost: 100, tier: 'large' },
  { id: 'big_wish', icon: 'wrapped-gift', cost: 100, tier: 'large' },
]

export const rewardTemplateName = (t: TFunction, template: RewardTemplate) =>
  t(`rewards.${template.id}`, { ns: 'pool' })

export const rewardTemplateIcon = (template: RewardTemplate) => iconId(template.icon)
