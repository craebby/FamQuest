import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router'

import { useMe, useSetupStatus } from './api/auth'
import { ApiError } from './api/client'
import { Button, FullScreenMessage } from './components/ui'
import { errorMessage } from './errors'
import { applyFamilyLanguage } from './i18n'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { ParentsPage } from './pages/ParentsPage'
import { SetupPage } from './pages/SetupPage'

function Loading() {
  const { t } = useTranslation()
  return (
    <FullScreenMessage>
      <p role="status">{t('common.loading')}</p>
    </FullScreenMessage>
  )
}

function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <FullScreenMessage>
      <p role="alert">{errorMessage(t, error)}</p>
      <Button onClick={onRetry}>{t('actions.retry')}</Button>
    </FullScreenMessage>
  )
}

/** Vor dem ersten Setup führt jeder Weg zur Setup-Seite, danach nie wieder. */
function SetupGate() {
  const status = useSetupStatus()
  const { pathname } = useLocation()

  if (status.isPending) return <Loading />
  if (status.isError)
    return <LoadError error={status.error} onRetry={() => void status.refetch()} />

  const required = status.data.setup_required
  if (required && pathname !== '/setup') return <Navigate to="/setup" replace />
  if (!required && pathname === '/setup') return <Navigate to="/" replace />
  return <Outlet />
}

/** Seiten, die eine Anmeldung brauchen. Setzt außerdem die Sprache der Familie. */
function RequireAuth() {
  const me = useMe()
  const familyLanguage = me.data?.family.default_language

  useEffect(() => {
    if (familyLanguage) applyFamilyLanguage(familyLanguage)
  }, [familyLanguage])

  if (me.isPending) return <Loading />
  if (me.isError) {
    if (me.error instanceof ApiError && me.error.status === 401)
      return <Navigate to="/login" replace />
    return <LoadError error={me.error} onRetry={() => void me.refetch()} />
  }
  return <Outlet />
}

function LoginRoute() {
  const me = useMe()
  if (me.isPending) return <Loading />
  return me.isSuccess ? <Navigate to="/" replace /> : <LoginPage />
}

export default function App() {
  return (
    <Routes>
      <Route element={<SetupGate />}>
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/login" element={<LoginRoute />} />
        <Route element={<RequireAuth />}>
          <Route index element={<HomePage />} />
          <Route path="/parents" element={<ParentsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
