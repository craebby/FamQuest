import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

import '../i18n'

// jsdom kennt kein Scrollen; der Elternbereich springt beim Wechsel der Ansicht nach oben.
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo

afterEach(cleanup)
