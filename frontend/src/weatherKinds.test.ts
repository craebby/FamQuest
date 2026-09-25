import { describe, expect, it } from 'vitest'

import { weatherKind } from './weatherKinds'

describe('weatherKind', () => {
  it.each([
    [0, 'clear'],
    [1, 'mostly_clear'],
    [2, 'partly_cloudy'],
    [3, 'cloudy'],
    [45, 'fog'],
    [53, 'drizzle'],
    [63, 'rain'],
    [66, 'rain'],
    [75, 'snow'],
    [86, 'snow'],
    [81, 'showers'],
    [95, 'thunder'],
    [99, 'thunder'],
    [42, 'cloudy'],
  ])('%i → %s', (code, kind) => {
    expect(weatherKind(code)).toBe(kind)
  })
})
