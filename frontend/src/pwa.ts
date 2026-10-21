import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

/** Die Einkaufsliste als App fürs Handy: startet hier, ohne Navigationsleiste. */
export const SHOP_PATH = '/shop'

/** Chromes Ereignis vor dem Installieren (nicht in den TypeScript-Typen). */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** Läuft schon als installierte App (vom Startbildschirm aus). */
export function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/** iPhone und iPad können nur über „Teilen → Zum Home-Bildschirm“ installieren. */
function isIos() {
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

/**
 * Macht die Einkaufsliste installierbar: Manifest in der Sprache der Familie und ein Service
 * Worker, der die App für den Laden ohne Netz speichert. Nur auf den Seiten der Einkaufsliste,
 * damit Display und Küchen-Tablet wie bisher laufen.
 */
export function useShopApp() {
  const { i18n } = useTranslation()
  const language = i18n.resolvedLanguage === 'en' ? 'en' : 'de'
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null)
  const [standalone, setStandalone] = useState(isStandalone)

  useEffect(() => {
    const link = document.createElement('link')
    link.rel = 'manifest'
    link.href = `/manifest-${language}.webmanifest`
    document.head.appendChild(link)
    return () => link.remove()
  }, [language])

  useEffect(() => {
    // Im Entwicklungsserver nicht: Der Service Worker hielte sonst alte Stände fest.
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js', { scope: SHOP_PATH }).catch(() => undefined)
  }, [])

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault()
      setPrompt(event as InstallPromptEvent)
    }
    const onInstalled = () => {
      setPrompt(null)
      setStandalone(true)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = prompt
    ? async () => {
        await prompt.prompt()
        setPrompt(null)
      }
    : null

  return {
    /** Android/Chrome: Installieren per Knopf. */
    install: standalone ? null : install,
    /** iPhone/iPad: nur ein Hinweis, wie es geht. */
    iosHint: !standalone && !prompt && isIos(),
  }
}
