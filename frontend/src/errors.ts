import type { TFunction } from 'i18next'

import { ApiError } from './api/client'

/** Übersetzt einen API-Fehler bzw. Fehlercode (z. B. `auth.rate_limited`). */
export function errorMessage(t: TFunction, error: unknown): string {
  const code = error instanceof ApiError ? error.code : typeof error === 'string' ? error : null
  const fallback = t('errors.common.unknown')
  return code ? t(`errors.${code}`, { defaultValue: fallback }) : fallback
}
