import { useMutation, useQuery } from '@tanstack/react-query'

import { api, apiGet } from './client'
import { useParentMutation } from './mutations'

/** Recht eines API-Schlüssels: nur lesen oder auch eintragen und abhaken. */
export const TOKEN_SCOPES = ['read', 'write'] as const
export type TokenScope = (typeof TOKEN_SCOPES)[number]

/** API-Schlüssel für andere Programme (Bon-Drucker, Home Assistant); der Schlüssel selbst fehlt. */
export interface ApiToken {
  id: number
  name: string
  /** Anfang des Schlüssels, z. B. „fq_Ab3d“, zum Auseinanderhalten. */
  prefix: string
  scope: TokenScope
  created_at: string
  last_used_at: string | null
}

/** Nur direkt nach dem Anlegen: mit dem ganzen Schlüssel, der danach nie wieder zu sehen ist. */
export interface NewApiToken extends ApiToken {
  token: string
}

/** Bon-Drucker: Adresse, an die „Drucken“ die Einkaufsliste schickt, und Breite in Zeichen. */
export interface Printer {
  url: string | null
  width: number
  /** Webseite der Druck-App (Etiketten, eigene Bons), in der Küchenansicht hinter dem Drucker-Symbol. */
  app_url: string | null
}

export const TOKENS_KEY = ['integrations', 'tokens'] as const
export const PRINTER_KEY = ['integrations', 'printer'] as const

export const useApiTokens = () =>
  useQuery({
    queryKey: TOKENS_KEY,
    queryFn: () => apiGet<ApiToken[]>('/integrations/tokens'),
  })

export const useAddApiToken = () =>
  useParentMutation(
    (body: { name: string; scope: TokenScope }) =>
      api<NewApiToken>('POST', '/integrations/tokens', body),
    [TOKENS_KEY],
  )

export const useDeleteApiToken = () =>
  useParentMutation((id: number) => api<void>('DELETE', `/integrations/tokens/${id}`), [TOKENS_KEY])

export const usePrinter = () =>
  useQuery({
    queryKey: PRINTER_KEY,
    queryFn: () => apiGet<Printer>('/integrations/printer'),
    // Richten die Eltern am Handy einen Drucker ein, erscheint der Knopf auch am Display.
    refetchInterval: 10 * 60 * 1000,
  })

export const useSavePrinter = () =>
  useParentMutation(
    (printer: Printer) => api<Printer>('PUT', '/integrations/printer', printer),
    [PRINTER_KEY],
  )

/** Schickt die offene Einkaufsliste an den Bon-Drucker (ohne Eltern-PIN). */
export const usePrintShopping = () =>
  useMutation({
    mutationFn: (lang: string) => api<{ items: number }>('POST', '/shopping/print', { lang }),
  })
