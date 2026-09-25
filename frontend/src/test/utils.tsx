import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'

import App from '../App'
import type { Me } from '../api/auth'
import type { Member } from '../api/members'
import type { Reward } from '../api/rewards'
import type { Today, TodayTask } from '../api/today'

type Handler = Response | ((body: unknown) => Response)

/** Ersetzt fetch durch feste Antworten je "METHODE /pfad". */
export function mockApi(routes: Record<string, Handler>) {
  const calls: { key: string; body: unknown; headers: Record<string, string> }[] = []
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost')
    const key = `${init?.method ?? 'GET'} ${url.pathname}`
    const raw = init?.body
    const body = raw instanceof Blob ? raw : raw ? JSON.parse(String(raw)) : undefined
    calls.push({ key, body, headers: (init?.headers ?? {}) as Record<string, string> })
    const handler = routes[key]
    if (!handler) return Response.json({ code: 'common.not_found' }, { status: 404 })
    return typeof handler === 'function' ? handler(body) : handler.clone()
  })
  vi.stubGlobal('fetch', fetchMock)
  return calls
}

export function renderApp(path = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

export function makeMe(overrides: Partial<Me> = {}): Me {
  return {
    user: { email: 'mama@example.org', role: 'admin', language: null },
    family: {
      name: 'Familie Sonnenschein',
      default_language: 'de',
      timezone: 'Europe/Berlin',
      pin_enabled: true,
    },
    csrf_token: 'csrf-123',
    parent_unlocked: false,
    ...overrides,
  }
}

export const setupDone = Response.json({ setup_required: false })
export const setupRequired = Response.json({ setup_required: true })
export const notAuthenticated = Response.json({ code: 'auth.not_authenticated' }, { status: 401 })

export function makeMember(overrides: Partial<Member> = {}): Member {
  return { id: 1, name: 'Lena', role: 'child', color: 'purple', avatar_url: null, ...overrides }
}

export function makeTodayTask(overrides: Partial<TodayTask> = {}): TodayTask {
  return {
    id: 1,
    title: 'Zähne putzen',
    icon: 'fluent-emoji-flat:toothbrush',
    points: 2,
    time_of_day: 'morning',
    color: null,
    member_ids: [1],
    done_member_ids: [],
    ...overrides,
  }
}

export function makeToday(overrides: Partial<Today> = {}): Today {
  return {
    date: '2026-10-03',
    week_start: '2026-09-28',
    time_of_day: 'morning',
    tasks: [],
    points: [],
    ...overrides,
  }
}

export function makeReward(overrides: Partial<Reward> = {}): Reward {
  return {
    id: 1,
    member_id: 1,
    name: 'Ein Eis',
    icon: 'fluent-emoji-flat:soft-ice-cream',
    description: '',
    cost: 10,
    active: true,
    ...overrides,
  }
}
