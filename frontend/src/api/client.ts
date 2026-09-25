/** Fehler aus der API. `code` ist ein Übersetzungsschlüssel unter `errors.*`. */
export class ApiError extends Error {
  readonly code: string
  readonly status: number
  /** Feldfehler bei Validierung: Feldname → Code (z. B. `validation.too_short`). */
  readonly fields: Record<string, string>

  constructor(code: string, status: number, fields: Record<string, string> = {}) {
    super(code)
    this.code = code
    this.status = status
    this.fields = fields
  }
}

// CSRF-Token der aktuellen Session; kommt mit jeder /auth/me-Antwort.
let csrfToken: string | null = null

export function setCsrfToken(token: string | null) {
  csrfToken = token
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export async function api<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  // Binärdaten (z. B. Bilder) gehen unverändert als Body raus, alles andere als JSON.
  const isBlob = body instanceof Blob
  if (isBlob) headers['Content-Type'] = body.type || 'application/octet-stream'
  else if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (method !== 'GET' && csrfToken) headers['X-CSRF-Token'] = csrfToken

  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers,
      body: isBlob ? body : body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
    })
  } catch {
    throw new ApiError('common.network', 0)
  }

  if (response.status === 204) return undefined as T
  const data: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const { code, fields } = (data ?? {}) as { code?: unknown; fields?: unknown }
    throw new ApiError(
      typeof code === 'string' ? code : 'common.unknown',
      response.status,
      fields && typeof fields === 'object' ? (fields as Record<string, string>) : {},
    )
  }
  return data as T
}

export const apiGet = <T>(path: string) => api<T>('GET', path)
