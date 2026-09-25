import { describe, expect, it } from 'vitest'

import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, resources } from './i18n'

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) =>
      flattenKeys(child, prefix ? `${prefix}.${key}` : key),
    )
  }
  return [prefix]
}

function leafValues(value: unknown): unknown[] {
  return value && typeof value === 'object' ? Object.values(value).flatMap(leafValues) : [value]
}

describe('Übersetzungen', () => {
  const reference = resources[DEFAULT_LANGUAGE]

  it('gibt es für jede unterstützte Sprache', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      expect(resources[language], language).toBeDefined()
    }
  })

  for (const language of SUPPORTED_LANGUAGES) {
    it(`${language}: hat dieselben Dateien und Schlüssel wie ${DEFAULT_LANGUAGE}`, () => {
      expect(Object.keys(resources[language]).sort()).toEqual(Object.keys(reference).sort())
      for (const namespace of Object.keys(reference)) {
        expect(flattenKeys(resources[language][namespace]).sort(), namespace).toEqual(
          flattenKeys(reference[namespace]).sort(),
        )
      }
    })

    it(`${language}: enthält nur nicht-leere Texte`, () => {
      for (const value of leafValues(resources[language])) {
        expect(typeof value === 'string' && value.trim().length > 0).toBe(true)
      }
    })
  }
})
