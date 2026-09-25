import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import GearIcon from '~icons/fluent-emoji-flat/gear'
import HouseIcon from '~icons/fluent-emoji-flat/house-with-garden'

import { useMe } from '../api/auth'

/** Platzhalter für die Familienansicht (kommt in Etappe 5). */
export function HomePage() {
  const { t } = useTranslation()
  const { data: me } = useMe()

  return (
    <main className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between gap-4 p-4 sm:p-6">
        <h1 className="text-3xl font-extrabold text-orange-600">{me?.family.name}</h1>
        <Link
          to="/parents"
          className="flex min-h-20 min-w-20 flex-col items-center justify-center gap-1 rounded-3xl bg-white px-3 py-2 text-sm font-bold text-slate-600 shadow-sm hover:bg-orange-100 focus-visible:outline-4 focus-visible:outline-orange-400"
        >
          <GearIcon className="size-10" aria-hidden="true" />
          {t('parents.title')}
        </Link>
      </header>
      <section className="flex flex-1 flex-col items-center justify-center gap-4 p-4 text-center">
        <HouseIcon className="size-32" aria-hidden="true" />
        <h2 className="text-3xl font-extrabold text-slate-800">{t('home.placeholder_title')}</h2>
        <p className="max-w-xl text-xl text-slate-600">{t('home.placeholder_text')}</p>
      </section>
    </main>
  )
}
