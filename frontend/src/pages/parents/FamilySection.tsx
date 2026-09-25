import { type FormEvent, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { type Me, useUpdateFamily } from '../../api/auth'
import { ApiError } from '../../api/client'
import { Alert, Button, Section, TextField } from '../../components/ui'
import { errorMessage } from '../../errors'
import { SUPPORTED_LANGUAGES } from '../../i18n'

/** Alle Zeitzonen des Browsers; die aktuelle ist immer dabei. */
function timeZones(current: string): string[] {
  const all = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []
  return all.includes(current) ? all : [current, ...all]
}

/** Familienname, Standardsprache und Zeitzone ändern. */
export function FamilySection({ me, onSaved }: { me: Me; onSaved: (message: string) => void }) {
  const { t } = useTranslation()
  const update = useUpdateFamily()
  const [name, setName] = useState(me.family.name)
  const [language, setLanguage] = useState(me.family.default_language)
  const [timeZone, setTimeZone] = useState(me.family.timezone)
  const zoneId = useId()

  const fieldError = (field: string) =>
    update.error instanceof ApiError && update.error.fields[field]
      ? errorMessage(t, update.error.fields[field])
      : undefined
  const nameError = !name.trim() ? errorMessage(t, 'validation.required') : fieldError('name')
  const changed =
    name.trim() !== me.family.name ||
    language !== me.family.default_language ||
    timeZone !== me.family.timezone

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    update.mutate(
      { name: name.trim(), default_language: language, timezone: timeZone },
      { onSuccess: () => onSaved(t('family_settings.saved')) },
    )
  }

  return (
    <Section title={t('family_settings.section')}>
      <form className="flex flex-col gap-5" onSubmit={submit} noValidate>
        {update.isError &&
          Object.keys(update.error instanceof ApiError ? update.error.fields : {}).length === 0 && (
            <Alert>{errorMessage(t, update.error)}</Alert>
          )}
        <TextField
          label={t('family_settings.name')}
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={100}
          autoComplete="off"
          error={nameError}
        />
        <div
          role="group"
          aria-label={t('family_settings.language')}
          className="flex flex-col gap-1.5"
        >
          <span className="text-base font-bold text-slate-700">
            {t('family_settings.language')}
          </span>
          <div className="grid grid-cols-2 gap-3 sm:max-w-md">
            {SUPPORTED_LANGUAGES.map((code) => (
              <Button
                key={code}
                variant={code === language ? 'primary' : 'secondary'}
                aria-pressed={code === language}
                onClick={() => setLanguage(code)}
              >
                {t(`languages.${code}`)}
              </Button>
            ))}
          </div>
          <p className="text-base text-slate-500">{t('family_settings.language_hint')}</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={zoneId} className="text-base font-bold text-slate-700">
            {t('family_settings.timezone')}
          </label>
          <select
            id={zoneId}
            value={timeZone}
            onChange={(event) => setTimeZone(event.target.value)}
            className="min-h-14 rounded-2xl border-2 border-slate-200 bg-white px-4 text-lg outline-none focus:border-orange-400"
          >
            {timeZones(me.family.timezone).map((zone) => (
              <option key={zone} value={zone}>
                {zone.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
          {fieldError('timezone') ? (
            <p className="text-base font-semibold text-red-700">{fieldError('timezone')}</p>
          ) : (
            <p className="text-base text-slate-500">{t('family_settings.timezone_hint')}</p>
          )}
        </div>
        <Button type="submit" className="self-start" disabled={!changed || update.isPending}>
          {t('family_settings.save')}
        </Button>
      </form>
    </Section>
  )
}
