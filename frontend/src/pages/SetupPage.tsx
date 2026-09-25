import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import StarIcon from '~icons/fluent-emoji-flat/glowing-star'

import { type SetupData, useSetup } from '../api/auth'
import { ApiError } from '../api/client'
import { PinPad } from '../components/PinPad'
import { Alert, Button, CenteredCard, TextField } from '../components/ui'
import { errorMessage } from '../errors'
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from '../i18n'
import { PASSWORD_MIN_LENGTH, isValidEmail } from '../validation'

type Step = 'details' | 'pin' | 'pin-repeat'
type DetailField = 'family_name' | 'email' | 'password'
const DETAIL_FIELDS: DetailField[] = ['family_name', 'email', 'password']

function browserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin'
}

export function SetupPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const setup = useSetup()

  const [step, setStep] = useState<Step>('details')
  const [details, setDetails] = useState<Record<DetailField, string>>({
    family_name: '',
    email: '',
    password: '',
  })
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<DetailField, string>>>({})
  const [firstPin, setFirstPin] = useState('')
  const [pinError, setPinError] = useState<string>()
  const [formError, setFormError] = useState<string>()

  const language = i18n.resolvedLanguage ?? DEFAULT_LANGUAGE

  const validateDetails = () => {
    const errors: Partial<Record<DetailField, string>> = {}
    if (!details.family_name.trim()) errors.family_name = 'validation.required'
    if (!isValidEmail(details.email)) errors.email = 'validation.invalid_email'
    if (details.password.length < PASSWORD_MIN_LENGTH)
      errors.password = 'validation.password_length'
    return errors
  }

  const submitDetails = (event: FormEvent) => {
    event.preventDefault()
    const errors = validateDetails()
    setFieldErrors(errors)
    if (Object.keys(errors).length === 0) setStep('pin')
  }

  const submitPin = (pin: string) => {
    setFirstPin(pin)
    setPinError(undefined)
    setStep('pin-repeat')
  }

  const submitPinRepeat = (pin: string) => {
    if (pin !== firstPin) {
      setPinError('pin.mismatch')
      setStep('pin')
      return
    }
    const data: SetupData = { ...details, language, pin, timezone: browserTimezone() }
    setup.mutate(data, {
      onSuccess: () => navigate('/', { replace: true }),
      onError: (error) => {
        const errors: Partial<Record<DetailField, string>> = {}
        if (error instanceof ApiError) {
          for (const field of DETAIL_FIELDS) {
            if (error.fields[field]) errors[field] = error.fields[field]
          }
        }
        setFieldErrors(errors)
        setFormError(Object.keys(errors).length ? undefined : errorMessage(t, error))
        setStep('details')
      },
    })
  }

  const fieldError = (field: DetailField) =>
    fieldErrors[field] &&
    t(`errors.${fieldErrors[field]}`, {
      min: PASSWORD_MIN_LENGTH,
      defaultValue: t('errors.validation.invalid'),
    })

  if (step !== 'details') {
    return (
      <CenteredCard>
        <p className="text-lg text-slate-600">{t('setup.pin_intro')}</p>
        <PinPad
          key={step}
          title={t(step === 'pin' ? 'setup.pin_title' : 'setup.pin_repeat_title')}
          onSubmit={step === 'pin' ? submitPin : submitPinRepeat}
          error={step === 'pin' && pinError ? errorMessage(t, pinError) : undefined}
          busy={setup.isPending}
        />
        <Button variant="secondary" onClick={() => setStep('details')} disabled={setup.isPending}>
          {t('actions.back')}
        </Button>
      </CenteredCard>
    )
  }

  return (
    <CenteredCard>
      <StarIcon className="mx-auto size-20" aria-hidden="true" />
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold text-orange-600">{t('setup.title')}</h1>
        <p className="text-lg text-slate-600">{t('setup.intro')}</p>
      </div>

      <div role="group" aria-label={t('setup.language')} className="grid grid-cols-2 gap-3">
        {SUPPORTED_LANGUAGES.map((code) => (
          <Button
            key={code}
            variant={code === language ? 'primary' : 'secondary'}
            aria-pressed={code === language}
            onClick={() => void i18n.changeLanguage(code)}
          >
            {t(`languages.${code}`)}
          </Button>
        ))}
      </div>

      <form className="flex flex-col gap-4" onSubmit={submitDetails} noValidate>
        {formError && <Alert>{formError}</Alert>}
        <TextField
          label={t('setup.family_name')}
          value={details.family_name}
          onChange={(event) => setDetails({ ...details, family_name: event.target.value })}
          error={fieldError('family_name')}
          maxLength={100}
          autoComplete="organization"
        />
        <TextField
          label={t('setup.email')}
          type="email"
          value={details.email}
          onChange={(event) => setDetails({ ...details, email: event.target.value })}
          error={fieldError('email')}
          autoComplete="email"
        />
        <TextField
          label={t('setup.password')}
          type="password"
          value={details.password}
          onChange={(event) => setDetails({ ...details, password: event.target.value })}
          error={fieldError('password')}
          hint={t('setup.password_hint', { min: PASSWORD_MIN_LENGTH })}
          autoComplete="new-password"
        />
        <Button type="submit">{t('actions.next')}</Button>
      </form>
    </CenteredCard>
  )
}
