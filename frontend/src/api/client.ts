/** Fehler aus der API. `code` ist ein Übersetzungsschlüssel unter `errors.*`. */
export class ApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, status: number) {
    super(code)
    this.code = code
    this.status = status
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, { credentials: 'same-origin' })
  } catch {
    throw new ApiError('common.network', 0)
  }
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const code =
      body && typeof body === 'object' && 'code' in body && typeof body.code === 'string'
        ? body.code
        : 'common.unknown'
    throw new ApiError(code, response.status)
  }
  return body as T
}
