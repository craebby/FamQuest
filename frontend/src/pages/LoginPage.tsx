import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import KeyIcon from '~icons/fluent-emoji-flat/key'

import { useLogin } from '../api/auth'
import { Alert, Button, CenteredCard, TextField } from '../components/ui'
import { errorMessage } from '../errors'

export function LoginPage() {
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
      <KeyIcon className="mx-auto size-20" aria-hidden="true" />
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
