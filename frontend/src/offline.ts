import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { QueryClient, onlineManager } from '@tanstack/react-query'
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client'
import { useSyncExternalStore } from 'react'

import { ME_KEY, type Me, SETUP_STATUS_KEY } from './api/auth'
import { setCsrfToken } from './api/client'
import {
  SHOPPING_ITEMS_KEY,
  SHOPPING_LIST_KEY,
  SHOPPING_OP_KEY,
  registerShoppingOps,
} from './api/shopping'

/**
 * Was auf dem Gerät gespeichert wird, damit die Einkaufsliste im Laden ohne Netz startet:
 * Anmeldung, Liste, Vorschläge und die noch nicht gesendeten Änderungen.
 */
const PERSISTED_QUERIES = [ME_KEY, SETUP_STATUS_KEY, SHOPPING_LIST_KEY, SHOPPING_ITEMS_KEY].map(
  (key): string => key[0],
)

// Länger als ein Einkauf ohne Netz dauern kann; danach lädt die App alles frisch.
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

export function createQueryClient() {
  // TanStack hört nur auf die Ereignisse online/offline; startet die App im Laden schon ohne
  // Netz, käme keins davon.
  if (!navigator.onLine) onlineManager.setOnline(false)
  const queryClient = new QueryClient()
  registerShoppingOps(queryClient)
  return queryClient
}

function storage() {
  try {
    return window.localStorage
  } catch {
    // Privates Fenster mit gesperrtem Speicher: Die App läuft, nur nicht offline.
    return undefined
  }
}

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister: createSyncStoragePersister({ storage: storage(), key: 'famquest-offline' }),
  maxAge: MAX_AGE_MS,
  // Ändert sich die Form der gespeicherten Daten, hier hochzählen.
  buster: '1',
  dehydrateOptions: {
    shouldDehydrateQuery: (query) =>
      query.state.status === 'success' && PERSISTED_QUERIES.includes(String(query.queryKey[0])),
    // Auch Änderungen, die gerade erneut versucht werden (Netz im Laden wackelt).
    shouldDehydrateMutation: (mutation) =>
      mutation.state.status === 'pending' &&
      mutation.options.mutationKey?.[0] === SHOPPING_OP_KEY[0],
  },
}

/**
 * Nach dem Laden vom Gerät die gespeicherten Änderungen senden (ohne Netz: warten). Läuft im
 * Hintergrund: Die App darf nicht darauf warten, sonst bliebe sie im Laden beim Laden stehen.
 */
export function resumeSavedChanges(queryClient: QueryClient): void {
  // /auth/me lädt erst gleich neu; die Änderungen brauchen den Token der Session aber sofort.
  const me = queryClient.getQueryData<Me>(ME_KEY)
  if (me) setCsrfToken(me.csrf_token)
  const pending = queryClient
    .getMutationCache()
    .getAll()
    .filter((mutation) => mutation.state.status === 'pending')
  for (const mutation of pending) mutation.continue().catch(() => undefined)
}

/** Ob das Gerät gerade Netz hat (laut Browser). */
export function useOnline() {
  return useSyncExternalStore(
    (listener) => onlineManager.subscribe(listener),
    () => onlineManager.isOnline(),
  )
}
