import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router'

import { useMe, useSetupStatus } from './api/auth'
import { ApiError } from './api/client'
import { AppShell } from './components/AppShell'
import { Button, FullScreenMessage } from './components/ui'
import { errorMessage } from './errors'
import { applyFamilyLanguage } from './i18n'
import { CalendarPage } from './pages/CalendarPage'
import { ChoresPage } from './pages/ChoresPage'
import { FamilyPage } from './pages/FamilyPage'
import { FramePage } from './pages/FramePage'
import { KITCHEN_PATH, KitchenPage } from './pages/KitchenPage'
import { LoginPage } from './pages/LoginPage'
import { MealsPage } from './pages/MealsPage'
import { ShoppingPage } from './pages/ShoppingPage'
import { ParentsPage } from './pages/ParentsPage'
import { PersonPage } from './pages/PersonPage'
import { RewardsPage } from './pages/RewardsPage'
import { SetupPage } from './pages/SetupPage'
import { TasksWeekPage } from './pages/TasksWeekPage'
import { TodayPage } from './pages/TodayPage'

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
  const { pathname } = useLocation()
  const familyLanguage = me.data?.family.default_language

  useEffect(() => {
    if (familyLanguage) applyFamilyLanguage(familyLanguage)
  }, [familyLanguage])

  if (me.isPending) return <Loading />
  if (me.isError) {
    if (me.error instanceof ApiError && me.error.status === 401)
      // Die Küchenansicht merkt sich ihre Adresse: Nach dem Anmelden geht es dorthin zurück.
      return (
        <Navigate
          to="/login"
          replace
          state={pathname === KITCHEN_PATH ? { from: pathname } : null}
        />
      )
    return <LoadError error={me.error} onRetry={() => void me.refetch()} />
  }
  return <Outlet />
}

function LoginRoute() {
  const me = useMe()
  const from = (useLocation().state as { from?: string } | null)?.from
  if (me.isPending) return <Loading />
  return me.isSuccess ? (
    <Navigate to={from === KITCHEN_PATH ? KITCHEN_PATH : '/'} replace />
  ) : (
    <LoginPage />
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<SetupGate />}>
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/login" element={<LoginRoute />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route index element={<TodayPage />} />
            <Route path="/tasks" element={<FamilyPage />} />
            <Route path="/tasks/week" element={<TasksWeekPage />} />
            <Route path="/member/:memberId" element={<PersonPage />} />
            <Route path="/rewards" element={<RewardsPage />} />
            <Route path="/rewards/:memberId" element={<RewardsPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/meals" element={<MealsPage />} />
            <Route path="/shopping" element={<ShoppingPage />} />
            <Route path="/household" element={<ChoresPage />} />
          </Route>
          <Route path="/frame" element={<FramePage />} />
          <Route path={KITCHEN_PATH} element={<KitchenPage />} />
          <Route path="/parents/:area?" element={<ParentsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
