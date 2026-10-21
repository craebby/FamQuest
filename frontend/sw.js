// Service Worker der Einkaufs-App (/shop): speichert die App für den Laden ohne Netz.
// Vorlage: Beim Build setzt vite.config.ts die Platzhalter ein (Dateien des Builds, Version).
// Die Daten der Liste speichert nicht er, sondern die App selbst (src/offline.ts); /api geht
// immer ans Netz.

const VERSION = __VERSION__
const PRECACHE = __PRECACHE__
const CACHE = `famquest-shop-${VERSION}`
// So lange darf der Server beim Öffnen brauchen, dann startet die gespeicherte App.
const NAVIGATION_TIMEOUT_MS = 4000

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('famquest-shop-') && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return
  if (request.mode === 'navigate') event.respondWith(navigate(request))
  else if (PRECACHE.includes(url.pathname))
    event.respondWith(caches.match(url.pathname).then((cached) => cached ?? fetch(request)))
})

/** Erst das Netz (neuester Stand), ohne Netz oder bei hängendem Netz die gespeicherte App. */
async function navigate(request) {
  const network = fetch(request)
  network.catch(() => undefined)
  const timeout = new Promise((resolve) => setTimeout(resolve, NAVIGATION_TIMEOUT_MS))
  try {
    const response = await Promise.race([network, timeout])
    // 502/503 kommen vom Reverse Proxy, wenn FamQuest gerade nicht läuft.
    if (response && response.status < 500) return response
  } catch {
    // Kein Netz.
  }
  return (await caches.match('/index.html')) ?? network
}
