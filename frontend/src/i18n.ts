import i18n, { type Resource } from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

export const SUPPORTED_LANGUAGES = ['de', 'en'] as const
export const DEFAULT_LANGUAGE = 'de'
export const LANGUAGE_STORAGE_KEY = 'famquest.language'

// Alle Dateien unter locales/<sprache>/<namespace>.json werden automatisch geladen.
// Eine neue Sprache braucht nur einen neuen Ordner und einen Eintrag in SUPPORTED_LANGUAGES.
const files = import.meta.glob<{ default: Record<string, unknown> }>('./locales/*/*.json', {
  eager: true,
})

export const resources: Resource = {}
for (const [path, module] of Object.entries(files)) {
  const [, language, namespace] = path.match(/\.\/locales\/([^/]+)\/([^/]+)\.json$/) ?? []
  if (!language || !namespace) continue
  resources[language] ??= {}
  resources[language][namespace] = module.default
}

i18n.on('languageChanged', (language) => {
  document.documentElement.lang = language
  document.title = i18n.t('app.name')
})

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    supportedLngs: SUPPORTED_LANGUAGES,
    fallbackLng: DEFAULT_LANGUAGE,
    load: 'languageOnly',
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    detection: {
      // Eine auf dem Gerät gewählte Sprache hat Vorrang, sonst die Browsersprache.
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: [],
    },
  })

export default i18n

/** Familiensprache anwenden, sofern auf diesem Gerät keine eigene Sprache gewählt wurde. */
export function applyFamilyLanguage(language: string) {
  let deviceLanguage: string | null = null
  try {
    deviceLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY)
  } catch {
    // Kein Zugriff auf localStorage (z. B. privater Modus): Familiensprache verwenden.
  }
  if (!deviceLanguage && i18n.resolvedLanguage !== language) {
    void i18n.changeLanguage(language)
  }
}
