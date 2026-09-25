import type { ComponentType, SVGProps } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet, useLocation } from 'react-router'
import GearIcon from '~icons/fluent-emoji-flat/gear'
import StarIcon from '~icons/fluent-emoji-flat/glowing-star'

interface NavItemProps {
  to: string
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  active: boolean
  className?: string
}

function NavItem({ to, label, icon: Icon, active, className = '' }: NavItemProps) {
  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      className={`flex min-h-20 min-w-20 flex-col items-center justify-center gap-1 rounded-3xl px-2 py-2 text-center text-sm leading-tight font-bold focus-visible:outline-4 focus-visible:outline-orange-400 ${active ? 'bg-orange-100 text-orange-800' : 'text-slate-600 hover:bg-orange-50'} ${className}`}
    >
      <Icon className="size-10" aria-hidden="true" />
      {label}
    </Link>
  )
}

/**
 * Rahmen des Alltagsbereichs: feste Navigationsleiste mit großen Symbolen,
 * links auf größeren Bildschirmen, unten am Smartphone.
 */
export function AppShell() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const onToday = pathname === '/' || pathname.startsWith('/member/')

  return (
    <div className="flex min-h-dvh flex-col sm:flex-row">
      <nav
        aria-label={t('nav.label')}
        className="fixed inset-x-0 bottom-0 z-10 flex gap-2 border-t border-orange-100 bg-white/95 p-2 backdrop-blur sm:sticky sm:top-0 sm:h-dvh sm:w-28 sm:shrink-0 sm:flex-col sm:border-t-0 sm:border-r sm:p-3"
      >
        <NavItem to="/" label={t('nav.today')} icon={StarIcon} active={onToday} />
        {/* Einstellungen abgesetzt am Ende der Leiste. */}
        <NavItem
          to="/parents"
          label={t('nav.settings')}
          icon={GearIcon}
          active={false}
          className="ml-auto sm:mt-auto sm:ml-0"
        />
      </nav>
      <div className="flex min-w-0 flex-1 flex-col pb-28 sm:pb-0">
        <Outlet />
      </div>
    </div>
  )
}
