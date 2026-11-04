import { useEffect, useState } from 'react'

import { useIdleTimeout } from './useIdleTimeout'

/** So oft fragt die App nach, ob eine neue Version läuft. */
export const VERSION_CHECK_MS = 10 * 60 * 1000

/**
 * Nach so langer Ruhe lädt eine veraltete App neu. Lang genug, dass niemand mitten im Eintippen
 * etwas verliert; das Tablet in der Küche ist trotzdem bald auf dem neuen Stand.
 */
export const RELOAD_IDLE_MS = 10 * 60 * 1000

// Das Skript der App trägt seinen Inhalt im Namen (`/assets/index-1a2b3c.js`): ein anderer Name,
// eine andere Version.
const SCRIPT = /<script[^>]*\ssrc="([^"]*\/assets\/[^"]+\.js)"/

/** Das Skript der App in einer ausgelieferten Startseite; null im Entwicklungsmodus. */
export function appScript(html: string): string | null {
  return SCRIPT.exec(html)?.[1] ?? null
}

const loadedScript = () =>
  document
    .querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/"]')
    ?.getAttribute('src') ?? null

/**
 * Geräte, die nie neu laden (Display am Kühlschrank, Tablet in der Küche), blieben sonst bei der
 * Version, mit der sie gestartet sind. Läuft auf dem Server eine neue, lädt die App neu, sobald
 * eine Weile niemand tippt. `enabled` false schaltet das ab (Einkaufs-App: Service Worker).
 */
export function useReloadOnNewVersion(enabled: boolean) {
  const [outdated, setOutdated] = useState(false)

  useEffect(() => {
    const current = loadedScript()
    if (!enabled || !current) return
    const check = () =>
      fetch('/', { cache: 'no-store', credentials: 'same-origin' })
        .then((response) => (response.ok ? response.text() : ''))
        .then((html) => {
          const next = appScript(html)
          if (next && next !== current) setOutdated(true)
        })
        // Ohne Netz oder beim Neustart des Servers: beim nächsten Mal.
        .catch(() => undefined)
    const timer = window.setInterval(check, VERSION_CHECK_MS)
    return () => window.clearInterval(timer)
  }, [enabled])

  useIdleTimeout(enabled && outdated ? RELOAD_IDLE_MS : null, () => window.location.reload())
}
