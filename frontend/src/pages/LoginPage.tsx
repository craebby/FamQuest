import { type FormEvent, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { type DemoInfo, useDemo, useDemoLogin, useLogin } from '../api/auth'
import { Logo } from '../components/Logo'
import { Alert, Button, CenteredCard, TextField } from '../components/ui'
import { errorMessage } from '../errors'
import { applyFamilyLanguage } from '../i18n'

export function LoginPage() {
  const demo = useDemo()
  return demo ? <DemoLogin demo={demo} /> : <PasswordLogin />
}

function PasswordLogin() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const login = useLogin()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    login.mutate({ email, password }, { onSuccess: () => navigate('/', { replace: true }) })
  }

  return (
    <CenteredCard>
      <Logo />
      <h1 className="text-3xl font-extrabold text-orange-600">{t('login.title')}</h1>
      <form className="flex flex-col gap-4" onSubmit={submit}>
        {login.isError && <Alert>{errorMessage(t, login.error)}</Alert>}
        <TextField
          label={t('login.email')}
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="username"
          required
        />
        <TextField
          label={t('login.password')}
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />
        <Button type="submit" disabled={login.isPending}>
          {t('login.submit')}
        </Button>
      </form>
    </CenteredCard>
  )
}

/** Öffentliche Demo: kein Passwort, ein Knopf meldet mit der Beispielfamilie an. */
function DemoLogin({ demo }: { demo: DemoInfo }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const login = useDemoLogin()

  useEffect(() => applyFamilyLanguage(demo.language), [demo.language])

  return (
    <CenteredCard>
      <Logo />
      <h1 className="text-3xl font-extrabold text-orange-600">{t('demo.title')}</h1>
      <p className="text-lg text-slate-700">{t('demo.intro')}</p>
      <p className="text-lg text-slate-700">
        {demo.reset_minutes === 60
          ? t('demo.reset_hourly')
          : t('demo.reset_minutes', { count: demo.reset_minutes })}
      </p>
      <p className="rounded-2xl bg-sky-100 px-4 py-3 text-lg font-bold text-sky-900">
        {t('demo.pin', { pin: demo.pin })}
      </p>
      {login.isError && <Alert>{errorMessage(t, login.error)}</Alert>}
      <Button
        onClick={() =>
          login.mutate(undefined, { onSuccess: () => navigate('/', { replace: true }) })
        }
        disabled={login.isPending}
      >
        {t('demo.open')}
      </Button>
    </CenteredCard>
  )
}
