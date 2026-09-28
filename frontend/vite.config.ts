/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import Icons from 'unplugin-icons/vite'
import { type Plugin, defineConfig } from 'vite'

const TASK_ICONS_ID = 'virtual:task-icons'
const CATEGORIES_FILE = fileURLToPath(new URL('./src/icons/categories.json', import.meta.url))
const COMPOSED_FILE = fileURLToPath(new URL('./src/icons/composed.json', import.meta.url))

/** Ebene eines zusammengesetzten Icons: ein Icon aus dem Set, verschoben, skaliert, umgefärbt. */
interface Layer {
  icon: string
  x: number
  y: number
  scale: number
  colors?: Record<string, string>
}

/**
 * Bettet nur die Icons des Aufgaben-Katalogs (src/icons/categories.json) ein,
 * statt des ganzen Icon-Sets (mehrere MB). Zur Laufzeit wird nichts nachgeladen.
 * Was es im Set nicht gibt (z. B. einen Schlafanzug), setzt src/icons/composed.json
 * aus Icons des Sets zusammen, damit es im selben Stil bleibt.
 */
function taskIcons(): Plugin {
  const resolvedId = `\0${TASK_ICONS_ID}`
  return {
    name: 'famquest-task-icons',
    resolveId: (source) => (source === TASK_ICONS_ID ? resolvedId : undefined),
    load(id) {
      if (id !== resolvedId) return
      this.addWatchFile(CATEGORIES_FILE)
      this.addWatchFile(COMPOSED_FILE)
      const composed: Record<string, Layer[]> = JSON.parse(readFileSync(COMPOSED_FILE, 'utf8'))
      const categories: { icons: string[] }[] = JSON.parse(readFileSync(CATEGORIES_FILE, 'utf8'))
      const iconSetFile = createRequire(import.meta.url).resolve(
        '@iconify-json/fluent-emoji-flat/icons.json',
      )
      const iconSet = JSON.parse(readFileSync(iconSetFile, 'utf8'))
      const icons: Record<string, string> = {}
      for (const name of categories.flatMap((category) => category.icons)) {
        const layers = composed[name]
        const icon = iconSet.icons[name]
        if (!icon && !layers) this.error(`Icon "${name}" fehlt im Icon-Set`)
        icons[name] = layers
          ? layers
              .map(({ icon: part, x, y, scale, colors = {} }) => {
                const body = iconSet.icons[part]?.body
                if (!body) this.error(`Icon "${part}" (Teil von "${name}") fehlt im Icon-Set`)
                const recolored = Object.entries(colors).reduce(
                  (result, [from, to]) => result.replaceAll(new RegExp(from, 'gi'), to),
                  body,
                )
                return `<g transform="translate(${x} ${y}) scale(${scale})">${recolored}</g>`
              })
              .join('')
          : icon.body
      }
      const data = { width: iconSet.width ?? 16, height: iconSet.height ?? 16, icons }
      return `export default ${JSON.stringify(data)}`
    },
  }
}

export default defineConfig({
  // Icons werden beim Build aus den Iconify-Paketen eingebettet (keine Abrufe zur Laufzeit).
  plugins: [react(), tailwindcss(), Icons({ compiler: 'jsx', jsx: 'react' }), taskIcons()],
  build: {
    // Die eingebetteten Aufgaben-Icons (~250 kB) gehören bewusst ins Bundle: Die App läuft im LAN,
    // und die Familienansicht braucht sie sofort.
    chunkSizeWarningLimit: 1000,
  },
  server: {
    // Lokale Entwicklung: API-Aufrufe an das Backend (uvicorn) weiterleiten.
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
  test: {
    environment: 'jsdom',
    // Playwright-Tests unter e2e/ laufen separat (npm run e2e).
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
  },
})
