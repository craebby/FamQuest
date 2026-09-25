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

/**
 * Bettet nur die Icons des Aufgaben-Katalogs (src/icons/categories.json) ein,
 * statt des ganzen Icon-Sets (mehrere MB). Zur Laufzeit wird nichts nachgeladen.
 */
function taskIcons(): Plugin {
  const resolvedId = `\0${TASK_ICONS_ID}`
  return {
    name: 'famquest-task-icons',
    resolveId: (source) => (source === TASK_ICONS_ID ? resolvedId : undefined),
    load(id) {
      if (id !== resolvedId) return
      this.addWatchFile(CATEGORIES_FILE)
      const categories: { icons: string[] }[] = JSON.parse(readFileSync(CATEGORIES_FILE, 'utf8'))
      const iconSetFile = createRequire(import.meta.url).resolve(
        '@iconify-json/fluent-emoji-flat/icons.json',
      )
      const iconSet = JSON.parse(readFileSync(iconSetFile, 'utf8'))
      const icons: Record<string, string> = {}
      for (const name of categories.flatMap((category) => category.icons)) {
        const icon = iconSet.icons[name]
        if (!icon) this.error(`Icon "${name}" fehlt im Icon-Set`)
        icons[name] = icon.body
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
