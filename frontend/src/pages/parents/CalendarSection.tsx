import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import CheckIcon from '~icons/fluent-emoji-flat/check-mark-button'
import CalendarIcon from '~icons/fluent-emoji-flat/spiral-calendar'
import WarningIcon from '~icons/fluent-emoji-flat/warning'

import {
  type CalendarConnection,
  useCalendarSettings,
  useConnectGoogle,
  useDisconnectCalendar,
} from '../../api/calendar'
import { Alert, Button, Section } from '../../components/ui'
import { errorMessage } from '../../errors'

/** Google-Konten verbinden und trennen (nur lesender Zugriff auf die Kalender). */
export function CalendarSection({ onDisconnected }: { onDisconnected: (email: string) => void }) {
  const { t } = useTranslation()
  const settings = useCalendarSettings()
  const connect = useConnectGoogle()
  const disconnect = useDisconnectCalendar()

  const data = settings.data
  return (
    <Section title={t('calendar.section')}>
      {settings.isError && <Alert>{errorMessage(t, settings.error)}</Alert>}
      {connect.isError && <Alert>{errorMessage(t, connect.error)}</Alert>}
      {disconnect.isError && <Alert>{errorMessage(t, disconnect.error)}</Alert>}
      {data && !data.configured && (
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-3 text-lg text-slate-600">
            <WarningIcon className="size-10 shrink-0" aria-hidden="true" />
            {t('calendar.not_configured')}
          </p>
          <RedirectUri uri={data.redirect_uri} />
        </div>
      )}
      {data?.configured && (
        <>
          <p className="text-lg text-slate-600">{t('calendar.intro')}</p>
          {data.connections.length > 0 && (
            <ul className="flex flex-col gap-3">
              {data.connections.map((connection) => (
                <ConnectionRow
                  key={connection.id}
                  connection={connection}
                  busy={connect.isPending || disconnect.isPending}
                  onReconnect={() => connect.mutate()}
                  onDisconnect={() =>
                    disconnect.mutate(connection.id, {
                      onSuccess: () => onDisconnected(connection.account_email),
                    })
                  }
                />
              ))}
            </ul>
          )}
          <Button
            className="self-start"
            disabled={connect.isPending}
            onClick={() => connect.mutate()}
          >
            <CalendarIcon className="size-8" aria-hidden="true" />
            {t('calendar.connect')}
          </Button>
          <details className="text-base text-slate-500">
            <summary className="cursor-pointer py-2">{t('calendar.setup_details')}</summary>
            <RedirectUri uri={data.redirect_uri} />
          </details>
        </>
      )}
    </Section>
  )
}

function RedirectUri({ uri }: { uri: string }) {
  const { t } = useTranslation()
  return (
    <p className="text-base text-slate-500">
      {t('calendar.redirect_uri')}{' '}
      <code className="rounded-lg bg-slate-100 px-2 py-1 break-all text-slate-700">{uri}</code>
    </p>
  )
}

function ConnectionRow({
  connection,
  busy,
  onReconnect,
  onDisconnect,
}: {
  connection: CalendarConnection
  busy: boolean
  onReconnect: () => void
  onDisconnect: () => void
}) {
  const { t } = useTranslation()
  const [confirming, setConfirming] = useState(false)
  const ok = connection.status === 'ok'
  const StatusIcon = ok ? CheckIcon : WarningIcon

  return (
    <li
      className={`flex flex-col gap-3 rounded-2xl p-4 ${ok ? 'bg-slate-50' : 'bg-amber-50'}`}
      data-testid="calendar-connection"
    >
      <div className="flex items-center gap-3">
        <StatusIcon className="size-10 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-slate-800">
            {connection.account_email}
          </p>
          <p className={`text-base ${ok ? 'text-slate-500' : 'font-semibold text-amber-800'}`}>
            {t(ok ? 'calendar.status_ok' : 'calendar.status_reconnect')}
          </p>
        </div>
      </div>
      {confirming ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-red-50 p-4">
          <p className="text-lg font-semibold text-red-800">
            {t('calendar.disconnect_confirm', { email: connection.account_email })}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="danger" disabled={busy} onClick={onDisconnect}>
              {t('calendar.disconnect')}
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              {t('actions.cancel')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {!ok && (
            <Button disabled={busy} onClick={onReconnect}>
              {t('calendar.reconnect')}
            </Button>
          )}
          <Button variant="secondary" disabled={busy} onClick={() => setConfirming(true)}>
            {t('calendar.disconnect')}
          </Button>
        </div>
      )}
    </li>
  )
}
