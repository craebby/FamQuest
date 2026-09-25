import { type ComponentType, type ReactNode, type SVGProps, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import GearIcon from '~icons/fluent-emoji-flat/gear'
import RightIcon from '~icons/fluent-emoji-flat/right-arrow'

type Icon = ComponentType<SVGProps<SVGSVGElement>>

/** Kachel der Startseite: großes Symbol und Titel, optional ein Pfeil zur ganzen Ansicht. */
export function Widget({
  title,
  icon: Icon,
  more,
  className = '',
  children,
}: {
  title: string
  icon: Icon
  /** Ziel und Beschriftung des Pfeils oben rechts. */
  more?: { to: string; label: string }
  className?: string
  children: ReactNode
}) {
  const id = useId()
  return (
    <section
      aria-labelledby={id}
      className={`flex min-w-0 flex-col gap-3 rounded-3xl bg-white/80 p-4 shadow-sm ${className}`}
    >
      <header className="flex items-center gap-3">
        <Icon className="size-10 shrink-0" aria-hidden="true" />
        <h2 id={id} className="min-w-0 flex-1 text-2xl font-extrabold text-slate-800">
          {title}
        </h2>
        {more && (
          <Link
            to={more.to}
            aria-label={more.label}
            title={more.label}
            className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-orange-50 hover:bg-orange-100 focus-visible:outline-4 focus-visible:outline-orange-400"
          >
            <RightIcon className="size-8" aria-hidden="true" />
          </Link>
        )}
      </header>
      {children}
    </section>
  )
}

/** Noch nicht eingerichtet: kurzer Hinweis mit Weg in den Elternbereich. */
export function SetupHint({ text }: { text: string }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-1 flex-col items-start gap-3">
      <p className="text-lg text-slate-600">{text}</p>
      <Link
        to="/parents"
        className="inline-flex min-h-14 items-center gap-2 rounded-2xl bg-orange-100 px-4 py-2 text-lg font-bold text-orange-800 hover:bg-orange-200 focus-visible:outline-4 focus-visible:outline-orange-400"
      >
        <GearIcon className="size-7" aria-hidden="true" />
        {t('home.setup')}
      </Link>
    </div>
  )
}

/** Platz für eine spätere Funktion, deutlich als „kommt bald“ gekennzeichnet. */
export function ComingSoon({
  title,
  icon: Icon,
  text,
}: {
  title: string
  icon: Icon
  text: string
}) {
  const { t } = useTranslation()
  const id = useId()
  return (
    <section
      aria-labelledby={id}
      className="flex min-w-0 flex-1 flex-col gap-3 rounded-3xl border-4 border-dashed border-slate-200 p-4"
    >
      <header className="flex items-center gap-3">
        <Icon className="size-10 shrink-0 opacity-50 grayscale" aria-hidden="true" />
        <h2 id={id} className="min-w-0 flex-1 text-2xl font-extrabold text-slate-400">
          {title}
        </h2>
        <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-base font-bold text-slate-500">
          {t('home.coming_soon')}
        </span>
      </header>
      <p className="text-lg text-slate-400">{text}</p>
    </section>
  )
}
