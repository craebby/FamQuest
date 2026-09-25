import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import App from './App'
import i18n from './i18n'

function renderApp() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  )
}

function mockFetch(response: Response | Error) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => (response instanceof Error ? Promise.reject(response) : Promise.resolve(response))),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Startseite', () => {
  it.each([
    ['de', 'Alles bereit'],
    ['en', 'All set'],
  ])('zeigt den Serverstatus auf %s', async (language, text) => {
    await i18n.changeLanguage(language)
    mockFetch(Response.json({ status: 'ok', database: 'ok' }))

    renderApp()

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(text))
    expect(document.documentElement.lang).toBe(language)
  })

  it('meldet einen nicht erreichbaren Server', async () => {
    await i18n.changeLanguage('de')
    mockFetch(new TypeError('Failed to fetch'))

    renderApp()

    expect(await screen.findByText('Server nicht erreichbar')).toBeInTheDocument()
  })
})
