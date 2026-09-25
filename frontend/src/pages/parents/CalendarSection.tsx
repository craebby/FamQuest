import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import CheckIcon from '~icons/fluent-emoji-flat/check-mark-button'
import RefreshIcon from '~icons/fluent-emoji-flat/counterclockwise-arrows-button'
import CalendarIcon from '~icons/fluent-emoji-flat/spiral-calendar'
import WarningIcon from '~icons/fluent-emoji-flat/warning'

import {
  type Calendar,
  type CalendarConnection,
  useCalendarSettings,
  useConnectGoogle,
  useDisconnectCalendar,
  useSetFamilyColor,
  useSyncCalendars,
  useUpdateCalendar,
} from '../../api/calendar'
import { type Member, useMembers } from '../../api/members'
import { Avatar } from '../../components/Avatar'
import { FamilyAvatar } from '../../components/FamilyAvatar'
import { Alert, Button, Section, Switch } from '../../components/ui'
import { errorMessage } from '../../errors'
import { COLOR_TOKENS, FAMILY_COLORS, type FamilyColor } from '../../memberColors'

/**
 * Google-Konten verbinden und trennen (nur lesender Zugriff), Kalender auswählen und einer
 * Person oder der ganzen Familie zuordnen.
 */
export function CalendarSection({ onDisconnected }: { onDisconnected: (email: string) => void }) {
  const { t } = useTranslation()
  const settings = useCalendarSettings()
  const members = useMembers().data ?? []
  const connect = useConnectGoogle()
  const disconnect = useDisconnectCalendar()
  const update = useUpdateCalendar()
  const setFamilyColor = useSetFamilyColor()
  const sync = useSyncCalendars()

  const data = settings.data
  const anySelected = data?.connections.some((c) => c.calendars.some((cal) => cal.selected))
  const errors = [settings, connect, disconnect, update, setFamilyColor, sync].filter(
    (request) => request.isError,
  )
  return (
    <Section title={t('calendar.section')}>
      {errors.map((request, index) => (
        <Alert key={index}>{errorMessage(t, request.error)}</Alert>
      ))}
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
            <>
              <p className="text-lg font-bold text-slate-700">{t('calendar.calendars')}</p>
              <ul className="flex flex-col gap-4">
                {data.connections.map((connection) => (
                  <ConnectionRow
                    key={connection.id}
                    connection={connection}
                    members={members}
                    familyColor={data.family_color}
                    busy={connect.isPending || disconnect.isPending}
                    updating={update.isPending}
                    onReconnect={() => connect.mutate()}
                    onDisconnect={() =>
                      disconnect.mutate(connection.id, {
                        onSuccess: () => onDisconnected(connection.account_email),
                      })
                    }
                    onChange={(calendar, selected, memberId) =>
                      update.mutate({ id: calendar.id, selected, memberId })
                    }
                  />
                ))}
              </ul>
              <FamilyColorPicker
                color={data.family_color}
                members={members}
                disabled={setFamilyColor.isPending}
                onChange={(color) => setFamilyColor.mutate(color)}
              />
            </>
          )}
          <div className="flex flex-wrap gap-3">
            <Button disabled={connect.isPending} onClick={() => connect.mutate()}>
              <CalendarIcon className="size-8" aria-hidden="true" />
              {t('calendar.connect')}
            </Button>
            {anySelected && (
              <Button
                variant="secondary"
                disabled={sync.isPending}
                onClick={() => sync.mutate(undefined)}
              >
                <RefreshIcon className="size-8" aria-hidden="true" />
                {t('calendar.sync_now')}
              </Button>
            )}
          </div>
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
  members,
  familyColor,
  busy,
  updating,
  onReconnect,
  onDisconnect,
  onChange,
}: {
  connection: CalendarConnection
  members: Member[]
  familyColor: FamilyColor
  busy: boolean
  updating: boolean
  onReconnect: () => void
  onDisconnect: () => void
  onChange: (calendar: Calendar, selected: boolean, memberId: number | null) => void
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
      {connection.calendars.length === 0 ? (
        ok && <p className="text-base text-slate-500">{t('calendar.no_calendars')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {connection.calendars.map((calendar) => (
            <CalendarRow
              key={calendar.id}
              calendar={calendar}
              members={members}
              familyColor={familyColor}
              disabled={updating}
              onChange={(selected, memberId) => onChange(calendar, selected, memberId)}
            />
          ))}
        </ul>
      )}
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

function CalendarRow({
  calendar,
  members,
  familyColor,
  disabled,
  onChange,
}: {
  calendar: Calendar
  members: Member[]
  familyColor: FamilyColor
  disabled: boolean
  onChange: (selected: boolean, memberId: number | null) => void
}) {
  const { t } = useTranslation()
  const owner = members.find((member) => member.id === calendar.member_id)
  const ownerColor = owner?.color ?? familyColor

  return (
    <li
      className="flex flex-col gap-3 rounded-2xl bg-white p-4 ring-2 ring-slate-100"
      style={
        calendar.selected ? { boxShadow: `inset 6px 0 0 ${COLOR_TOKENS[ownerColor].main}` } : {}
      }
      data-testid="calendar"
    >
      <div className="flex items-center gap-3">
        <Switch
          checked={calendar.selected}
          disabled={disabled}
          label={t('calendar.show', { name: calendar.name })}
          onChange={(selected) => onChange(selected, calendar.member_id)}
        />
        <div className="min-w-0">
          <p className="text-lg font-semibold break-words text-slate-800">{calendar.name}</p>
          {calendar.primary && <p className="text-base text-slate-500">{t('calendar.primary')}</p>}
        </div>
      </div>
      {calendar.selected && (
        <>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-base font-bold text-slate-700">
              {t('calendar.belongs_to')}
            </legend>
            <div className="flex flex-wrap gap-2">
              <OwnerOption
                name={`owner-${calendar.id}`}
                label={t('calendar.family')}
                checked={calendar.member_id === null}
                disabled={disabled}
                onSelect={() => onChange(true, null)}
              >
                <FamilyAvatar color={familyColor} size="xs" />
              </OwnerOption>
              {members.map((member) => (
                <OwnerOption
                  key={member.id}
                  name={`owner-${calendar.id}`}
                  label={member.name}
                  checked={calendar.member_id === member.id}
                  disabled={disabled}
                  onSelect={() => onChange(true, member.id)}
                >
                  <Avatar
                    name={member.name}
                    color={member.color}
                    src={member.avatar_url}
                    size="xs"
                  />
                </OwnerOption>
              ))}
            </div>
          </fieldset>
          <SyncState calendar={calendar} />
        </>
      )}
    </li>
  )
}

function OwnerOption({
  name,
  label,
  checked,
  disabled,
  onSelect,
  children,
}: {
  name: string
  label: string
  checked: boolean
  disabled: boolean
  onSelect: () => void
  children: ReactNode
}) {
  return (
    <label className="cursor-pointer has-disabled:cursor-not-allowed">
      <input
        type="radio"
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
        className="peer sr-only"
      />
      <span className="flex min-h-12 items-center gap-2 rounded-full bg-slate-50 py-1 pr-4 pl-1 text-base font-bold text-slate-700 ring-2 ring-slate-200 peer-checked:bg-orange-50 peer-checked:ring-4 peer-checked:ring-slate-800 peer-focus-visible:outline-4 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-orange-400">
        {children}
        {label}
      </span>
    </label>
  )
}

function SyncState({ calendar }: { calendar: Calendar }) {
  const { t, i18n } = useTranslation()
  if (calendar.sync_error) {
    return (
      <p className="flex items-center gap-2 text-base font-semibold text-amber-800">
        <WarningIcon className="size-6 shrink-0" aria-hidden="true" />
        {errorMessage(t, calendar.sync_error)}
      </p>
    )
  }
  if (!calendar.synced_at) {
    return (
      <p role="status" className="text-base text-slate-500">
        {t('calendar.loading')}
      </p>
    )
  }
  const time = new Intl.DateTimeFormat(i18n.resolvedLanguage ?? i18n.language, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(calendar.synced_at))
  return <p className="text-base text-slate-500">{t('calendar.synced_at', { time })}</p>
}

function FamilyColorPicker({
  color,
  members,
  disabled,
  onChange,
}: {
  color: FamilyColor
  members: Member[]
  disabled: boolean
  onChange: (color: FamilyColor) => void
}) {
  const { t } = useTranslation()
  const takenBy = new Map<string, string>(members.map((member) => [member.color, member.name]))
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 flex items-center gap-3 text-base font-bold text-slate-700">
        <FamilyAvatar color={color} size="sm" />
        <span>
          {t('calendar.family_color')}
          <span className="block font-normal text-slate-500">
            {t('calendar.family_color_hint')}
          </span>
        </span>
      </legend>
      <div className="flex flex-wrap gap-3">
        {FAMILY_COLORS.map((value) => {
          const owner = takenBy.get(value)
          const tokens = COLOR_TOKENS[value]
          const colorName = t(`colors.${value}`)
          const label = owner
            ? t('calendar.color_taken_by', { color: colorName, name: owner })
            : colorName
          return (
            <label key={value} className={owner ? 'cursor-not-allowed' : 'cursor-pointer'}>
              <input
                type="radio"
                name="family-color"
                value={value}
                checked={color === value}
                disabled={disabled || owner !== undefined}
                onChange={() => onChange(value)}
                aria-label={label}
                className="peer sr-only"
              />
              <span
                className="flex size-14 items-center justify-center rounded-full ring-offset-4 peer-checked:ring-4 peer-checked:ring-slate-800 peer-focus-visible:outline-4 peer-focus-visible:outline-offset-8 peer-focus-visible:outline-orange-400 peer-disabled:opacity-25"
                style={{ backgroundColor: tokens.main, color: tokens.onMain }}
                title={label}
              >
                {color === value && <CheckIcon className="size-7" aria-hidden="true" />}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
