import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import EyeIcon from '~icons/fluent-emoji-flat/eye'
import KeyIcon from '~icons/fluent-emoji-flat/key'
import PencilIcon from '~icons/fluent-emoji-flat/pencil'
import PrinterIcon from '~icons/fluent-emoji-flat/printer'
import TrashIcon from '~icons/fluent-emoji-flat/wastebasket'
import CopyIcon from '~icons/lucide/copy'

import {
  type NewApiToken,
  TOKEN_SCOPES,
  type TokenScope,
  useAddApiToken,
  useApiTokens,
  useDeleteApiToken,
  usePrinter,
  useSavePrinter,
} from '../../api/integrations'
import { Alert, Button, Section, TextField } from '../../components/ui'
import { errorMessage } from '../../errors'
import { ChoiceTile, Field } from './formParts'

/** Breite des Bons in Zeichen: 32 passt auf 58-mm-Papier, 48 auf 80 mm. */
const PRINT_WIDTHS = [32, 42, 48] as const
const SCOPE_ICONS = { read: EyeIcon, write: PencilIcon } as const

/**
 * Schnittstellen für andere Programme: Bon-Drucker (Adresse, an die „Drucken“ die Einkaufsliste
 * schickt) und API-Schlüssel für `/api/v1`, z. B. für Home Assistant. Ein neuer Schlüssel ist nur
 * direkt nach dem Anlegen zu sehen.
 */
export function IntegrationsSection({ onSaved }: { onSaved: (message: string) => void }) {
  const { t } = useTranslation()
  return (
    <Section title={t('integrations.section')}>
      <p className="-mt-1 text-base text-slate-500">{t('integrations.intro')}</p>
      <PrinterSettings onSaved={onSaved} />
      <ApiTokens />
    </Section>
  )
}

function PrinterSettings({ onSaved }: { onSaved: (message: string) => void }) {
  const { t } = useTranslation()
  const printer = usePrinter()
  const save = useSavePrinter()
  const [url, setUrl] = useState<string | null>(null)
  const [width, setWidth] = useState<number | null>(null)
  const [appUrl, setAppUrl] = useState<string | null>(null)
  const data = printer.data
  if (!data) return printer.error ? <Alert>{errorMessage(t, printer.error)}</Alert> : null
  const shownUrl = url ?? data.url ?? ''
  const shownWidth = width ?? data.width
  const shownAppUrl = appUrl ?? data.app_url ?? ''

  const submit = (event: FormEvent) => {
    event.preventDefault()
    save.mutate(
      { url: shownUrl.trim() || null, width: shownWidth, app_url: shownAppUrl.trim() || null },
      {
        onSuccess: (saved) => {
          setUrl(null)
          setWidth(null)
          setAppUrl(null)
          onSaved(
            saved.url || saved.app_url
              ? t('integrations.printer_saved')
              : t('integrations.printer_removed'),
          )
        },
      },
    )
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
      <h3 className="flex items-center gap-2 text-xl font-extrabold text-slate-800">
        <PrinterIcon className="size-8" aria-hidden="true" />
        {t('integrations.printer')}
      </h3>
      <p className="-mt-2 text-base text-slate-500">{t('integrations.printer_hint')}</p>
      {save.error ? <Alert>{errorMessage(t, save.error)}</Alert> : null}
      <TextField
        label={t('integrations.printer_url')}
        hint={t('integrations.printer_url_hint')}
        type="url"
        inputMode="url"
        placeholder="http://drucker.fritz.box:8090/print"
        value={shownUrl}
        onChange={(event) => setUrl(event.target.value)}
        maxLength={300}
        autoComplete="off"
      />
      <Field label={t('integrations.printer_width')}>
        <div className="grid grid-cols-3 gap-3 sm:max-w-md">
          {PRINT_WIDTHS.map((option) => (
            <ChoiceTile
              key={option}
              name="printer-width"
              checked={shownWidth === option}
              onChange={() => setWidth(option)}
            >
              {t('integrations.chars', { count: option })}
              <span className="text-base font-normal text-slate-500">
                {t(`integrations.paper_${option}`)}
              </span>
            </ChoiceTile>
          ))}
        </div>
      </Field>
      <TextField
        label={t('integrations.app_url')}
        hint={t('integrations.app_url_hint')}
        type="url"
        inputMode="url"
        placeholder="http://druck.fritz.box:8200"
        value={shownAppUrl}
        onChange={(event) => setAppUrl(event.target.value)}
        maxLength={300}
        autoComplete="off"
      />
      <Button type="submit" className="self-start" disabled={save.isPending}>
        {t('actions.save')}
      </Button>
    </form>
  )
}

function ApiTokens() {
  const { t, i18n } = useTranslation()
  const tokens = useApiTokens()
  const add = useAddApiToken()
  const remove = useDeleteApiToken()
  const [name, setName] = useState('')
  const [scope, setScope] = useState<TokenScope>('read')
  const [created, setCreated] = useState<NewApiToken | null>(null)
  const [confirm, setConfirm] = useState<number | null>(null)
  const language = i18n.resolvedLanguage ?? i18n.language
  const dateTime = new Intl.DateTimeFormat(language, { dateStyle: 'short', timeStyle: 'short' })
  const error = add.error ?? remove.error ?? tokens.error

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    add.mutate(
      { name: name.trim(), scope },
      {
        onSuccess: (token) => {
          setCreated(token)
          setName('')
          setScope('read')
        },
      },
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="flex items-center gap-2 text-xl font-extrabold text-slate-800">
        <KeyIcon className="size-8" aria-hidden="true" />
        {t('integrations.tokens')}
      </h3>
      <p className="-mt-2 text-base text-slate-500">
        {t('integrations.tokens_hint', { url: `${window.location.origin}/api/v1` })}
      </p>
      {error ? <Alert>{errorMessage(t, error)}</Alert> : null}

      {created && <CreatedToken token={created} onDone={() => setCreated(null)} />}

      {(tokens.data?.length ?? 0) > 0 && (
        <ul className="flex flex-col gap-2">
          {tokens.data?.map((token) => (
            <li
              key={token.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl bg-slate-50 p-3 ring-2 ring-slate-200"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-lg font-bold text-slate-800">{token.name}</span>
                <span className="text-base text-slate-500">
                  <code>{token.prefix}…</code> · {t(`integrations.scope_${token.scope}`)} ·{' '}
                  {token.last_used_at
                    ? t('integrations.last_used', {
                        time: dateTime.format(new Date(token.last_used_at)),
                      })
                    : t('integrations.never_used')}
                </span>
              </div>
              {confirm === token.id ? (
                <div className="flex gap-2">
                  <Button
                    variant="danger"
                    onClick={() => remove.mutate(token.id, { onSettled: () => setConfirm(null) })}
                  >
                    {t('integrations.delete_confirm')}
                  </Button>
                  <Button variant="secondary" onClick={() => setConfirm(null)}>
                    {t('actions.cancel')}
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  aria-label={t('integrations.delete', { name: token.name })}
                  title={t('integrations.delete', { name: token.name })}
                  onClick={() => setConfirm(token.id)}
                  className="flex size-14 shrink-0 items-center justify-center rounded-2xl ring-2 ring-red-200 hover:bg-red-50 focus-visible:outline-4 focus-visible:outline-orange-400"
                >
                  <TrashIcon className="size-7" aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        <TextField
          label={t('integrations.token_name')}
          placeholder={t('integrations.token_name_placeholder')}
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={60}
          autoComplete="off"
        />
        <Field label={t('integrations.scope')}>
          <div className="grid grid-cols-2 gap-3 sm:max-w-xl">
            {TOKEN_SCOPES.map((option) => {
              const Icon = SCOPE_ICONS[option]
              return (
                <ChoiceTile
                  key={option}
                  name="token-scope"
                  checked={scope === option}
                  onChange={() => setScope(option)}
                >
                  <Icon className="size-10" aria-hidden="true" />
                  {t(`integrations.scope_${option}`)}
                  <span className="text-base font-normal text-slate-500">
                    {t(`integrations.scope_${option}_hint`)}
                  </span>
                </ChoiceTile>
              )
            })}
          </div>
        </Field>
        <Button type="submit" className="self-start" disabled={add.isPending || !name.trim()}>
          <KeyIcon className="size-7" aria-hidden="true" />
          {t('integrations.create')}
        </Button>
      </form>
    </div>
  )
}

/** Der neue Schlüssel, einmal zum Kopieren. */
function CreatedToken({ token, onDone }: { token: NewApiToken; onDone: () => void }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(token.token)
      setCopied(true)
    } catch {
      // Ohne Zwischenablage (z. B. ohne HTTPS) bleibt Markieren und Kopieren von Hand.
    }
  }
  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-2xl bg-green-50 p-4 ring-2 ring-green-300"
    >
      <p className="text-lg font-bold text-green-900">
        {t('integrations.created', { name: token.name })}
      </p>
      <code className="rounded-xl bg-white p-3 text-base break-all text-slate-800 select-all">
        {token.token}
      </code>
      <div className="flex flex-wrap gap-3">
        {window.isSecureContext && (
          <Button variant="secondary" onClick={() => void copy()}>
            <CopyIcon className="size-6" aria-hidden="true" />
            {copied ? t('integrations.copied') : t('integrations.copy')}
          </Button>
        )}
        <Button onClick={onDone}>{t('integrations.created_done')}</Button>
      </div>
    </div>
  )
}
