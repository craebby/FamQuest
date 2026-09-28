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
 * Nur Dinge, die es nicht ohnehin gibt; die Preise gehen von etwa 15–20 Punkten am Tag aus,
 * große Belohnungen sind zum Sparen über Wochen gedacht.
 * Der Name wird beim Übernehmen in der aktuellen Sprache gespeichert und ist danach frei änderbar.
 */
export const REWARD_POOL: readonly RewardTemplate[] = [
  { id: 'breakfast', icon: 'pancakes', cost: 15, tier: 'small' },
  { id: 'screen_15', icon: 'mobile-phone', cost: 20, tier: 'small' },
  { id: 'stay_up', icon: 'crescent-moon', cost: 30, tier: 'medium' },
  { id: 'screen_30', icon: 'television', cost: 40, tier: 'medium' },
  { id: 'pick_movie', icon: 'clapper-board', cost: 40, tier: 'medium' },
  { id: 'favorite_meal', icon: 'shallow-pan-of-food', cost: 40, tier: 'medium' },
  { id: 'ice_cafe', icon: 'ice-cream', cost: 60, tier: 'medium' },
  { id: 'special_activity', icon: 'balloon', cost: 80, tier: 'medium' },
  { id: 'screen_60', icon: 'video-game', cost: 100, tier: 'large' },
  { id: 'piggy_bank', icon: 'coin', cost: 100, tier: 'large' },
  { id: 'small_toy', icon: 'teddy-bear', cost: 200, tier: 'large' },
  { id: 'sleepover', icon: 'camping', cost: 250, tier: 'large' },
  { id: 'day_out', icon: 'national-park', cost: 300, tier: 'large' },
  { id: 'theme_park', icon: 'roller-coaster', cost: 400, tier: 'large' },
  { id: 'big_wish', icon: 'wrapped-gift', cost: 500, tier: 'large' },
]

export const rewardTemplateName = (t: TFunction, template: RewardTemplate) =>
  t(`rewards.${template.id}`, { ns: 'pool' })

export const rewardTemplateIcon = (template: RewardTemplate) => iconId(template.icon)
