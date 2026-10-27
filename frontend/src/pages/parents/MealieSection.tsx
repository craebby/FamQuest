import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import BookIcon from '~icons/fluent-emoji-flat/open-book'
import CookIcon from '~icons/fluent-emoji-flat/cook'
import LinkIcon from '~icons/fluent-emoji-flat/link'
import MixIcon from '~icons/fluent-emoji-flat/books'
import RefreshIcon from '~icons/lucide/refresh-cw'

import {
  MEALIE_MODES,
  type MealieMode,
  mealieRecipesOn,
  useMealie,
  useSaveMealie,
  useSyncMealie,
} from '../../api/mealie'
import { Alert, Button, Section, TextField } from '../../components/ui'
import { errorMessage } from '../../errors'
import { ChoiceTile, Field } from './formParts'

const MODE_ICONS = { off: BookIcon, link: LinkIcon, mixed: MixIcon, only: CookIcon }

/**
 * Mealie als Rezeptquelle: Modus (aus, nur Knopf, gemischt, nur Mealie), Adresse und API-Token.
 * Der Token geht nur zum Server und kommt nie zurück; Speichern prüft die Verbindung und gleicht
 * gleich ab. Gilt für die ganze Familie.
 */
export function MealieSection({ onSaved }: { onSaved: (message: string) => void }) {
  const { t, i18n } = useTranslation()
  const mealie = useMealie()
  const save = useSaveMealie()
  const sync = useSyncMealie()
  const settings = mealie.data
  const [mode, setMode] = useState<MealieMode | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [token, setToken] = useState('')
  const shownMode = mode ?? settings?.mode ?? 'off'
  const shownUrl = url ?? settings?.url ?? ''
  const needsToken = shownMode === 'mixed' || shownMode === 'only'
  const error = save.error ?? sync.error
  const language = i18n.resolvedLanguage ?? i18n.language

  const submit = (event: FormEvent) => {
    event.preventDefault()
    save.mutate(
      {
        mode: shownMode,
        url: shownUrl.trim() || undefined,
        token: token.trim() || undefined,
      },
      {
        onSuccess: (saved) => {
          setMode(null)
          setUrl(null)
          setToken('')
          onSaved(
            mealieRecipesOn(saved)
              ? t('mealie.saved_recipes', { count: saved.recipes })
              : t('mealie.saved'),
          )
        },
      },
    )
  }

  if (!settings) {
    return (
      <Section title={t('mealie.section')}>
        {mealie.error ? (
          <Alert>{errorMessage(t, mealie.error)}</Alert>
        ) : (
          <p role="status">{t('common.loading')}</p>
        )}
      </Section>
    )
  }

  return (
    <Section title={t('mealie.section')}>
      <form className="flex flex-col gap-5" onSubmit={submit} noValidate>
        <p className="-mt-1 text-base text-slate-500">{t('mealie.intro')}</p>
        {error ? <Alert>{errorMessage(t, error)}</Alert> : null}

        <Field label={t('mealie.mode')}>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-3">
            {MEALIE_MODES.map((option) => {
              const Icon = MODE_ICONS[option]
              return (
                <ChoiceTile
                  key={option}
                  name="mealie-mode"
                  checked={shownMode === option}
                  onChange={() => setMode(option)}
                >
                  <Icon className="size-10" aria-hidden="true" />
                  {t(`mealie.mode_${option}`)}
                  <span className="text-base font-normal text-slate-500">
                    {t(`mealie.mode_${option}_hint`)}
                  </span>
                </ChoiceTile>
              )
            })}
          </div>
        </Field>

        {shownMode !== 'off' && (
          <TextField
            label={t('mealie.url')}
            hint={t('mealie.url_hint')}
            type="url"
            inputMode="url"
            placeholder="https://mealie.example.org"
            value={shownUrl}
            onChange={(event) => setUrl(event.target.value)}
            maxLength={300}
            autoComplete="off"
          />
        )}
        {needsToken && (
          <TextField
            label={t('mealie.token')}
            hint={settings.can_store_token ? t('mealie.token_hint') : t('mealie.token_no_key')}
            type="password"
            placeholder={settings.has_token ? t('mealie.token_saved') : ''}
            value={token}
            onChange={(event) => setToken(event.target.value)}
            maxLength={2000}
            autoComplete="off"
            disabled={!settings.can_store_token}
          />
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending && needsToken ? t('mealie.connecting') : t('actions.save')}
          </Button>
          {mealieRecipesOn(settings) && (
            <Button
              variant="secondary"
              disabled={sync.isPending || save.isPending}
              onClick={() => sync.mutate(undefined)}
            >
              <RefreshIcon className="size-6" aria-hidden="true" />
              {t('mealie.sync_now')}
            </Button>
          )}
        </div>

        {mealieRecipesOn(settings) && (
          <div className="flex flex-col gap-2">
            <p className="text-lg text-slate-700" role="status">
              {t('mealie.status', { count: settings.recipes })}
              {settings.synced_at &&
                ` · ${t('mealie.synced_at', {
                  time: new Intl.DateTimeFormat(language, {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  }).format(new Date(settings.synced_at)),
                })}`}
            </p>
            {settings.sync_error && (
              <Alert>
                {t('mealie.sync_failed')} {t(`errors.${settings.sync_error}`)}
              </Alert>
            )}
          </div>
        )}
      </form>
    </Section>
  )
}
