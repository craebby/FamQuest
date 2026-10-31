import { type FormEvent, useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  type EventInput,
  type WeekEvent,
  type WritableCalendar,
  useCreateEvent,
  useUpdateEvent,
} from '../../api/calendar'
import { useMembers } from '../../api/members'
import { Avatar } from '../../components/Avatar'
import { FamilyAvatar } from '../../components/FamilyAvatar'
import { Alert, Button, Switch, TextAreaField, TextField } from '../../components/ui'
import { errorMessage } from '../../errors'
import { OwnerOption } from './OwnerOption'

const DEFAULT_START = '09:00'
const DEFAULT_END = '10:00'

/** Datum und Uhrzeit eines Zeitpunkts in der Zeitzone der Familie. */
function localParts(iso: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).formatToParts(new Date(iso))
  const part = (type: string) => parts.find((item) => item.type === type)?.value
  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    time: `${part('hour')}:${part('minute')}`,
  }
}

function dayBefore(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10)
}

function initialInput(event: WeekEvent | undefined, date: string, timeZone: string): EventInput {
  const shared = {
    title: event?.title ?? '',
    location: event?.location ?? '',
    description: event?.description ?? '',
  }
  if (!event) {
    return {
      ...shared,
      all_day: false,
      start_date: date,
      end_date: date,
      start_time: DEFAULT_START,
      end_time: DEFAULT_END,
    }
  }
  if (event.all_day) {
    return {
      ...shared,
      all_day: true,
      start_date: event.start,
      // Bei Google ist das Ende exklusiv, im Formular der letzte Tag.
      end_date: dayBefore(event.end),
      start_time: DEFAULT_START,
      end_time: DEFAULT_END,
    }
  }
  const start = localParts(event.start, timeZone)
  const end = localParts(event.end, timeZone)
  return {
    ...shared,
    all_day: false,
    start_date: start.date,
    end_date: end.date,
    start_time: start.time,
    end_time: end.time,
  }
}

/** Termin anlegen (mit `calendars` und `date`) oder ändern (mit `event`). */
export function EventForm({
  event,
  calendars = [],
  date = '',
  timeZone,
  familyColor,
  onClose,
}: {
  event?: WeekEvent
  calendars?: WritableCalendar[]
  date?: string
  timeZone: string
  familyColor: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [input, setInput] = useState(() => initialInput(event, date, timeZone))
  const [calendarId, setCalendarId] = useState(calendars[0]?.id)
  const members = useMembers().data ?? []
  // Nur in Kalendern, die Personen über Farben unterscheiden.
  const choices =
    event?.person_choices ?? calendars.find((item) => item.id === calendarId)?.person_choices ?? []
  const [chosen, setChosen] = useState<number | null | undefined>(
    event ? (event.member_ids[0] ?? null) : undefined,
  )
  // Beim Wechsel des Kalenders gilt ohne eigene Wahl dessen Person.
  const person = chosen !== undefined && choices.includes(chosen) ? chosen : (choices[0] ?? null)
  const create = useCreateEvent()
  const update = useUpdateEvent()
  const saving = event ? update : create
  const titleId = useId()
  const calendarFieldId = useId()

  useEffect(() => {
    const onKey = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const change = (changes: Partial<EventInput>) => setInput({ ...input, ...changes })
  const startDate = (start_date: string) =>
    // Das Ende geht mit, sonst läge es nach dem Vorziehen schnell vor dem Beginn.
    change({ start_date, end_date: input.end_date < start_date ? start_date : input.end_date })

  const endsBeforeStart = input.all_day
    ? input.end_date < input.start_date
    : `${input.end_date} ${input.end_time}` < `${input.start_date} ${input.start_time}`

  const submit = (submitEvent: FormEvent) => {
    submitEvent.preventDefault()
    if (endsBeforeStart) return
    const payload: EventInput = {
      ...input,
      title: input.title.trim(),
      location: input.location?.trim() || null,
      description: input.description?.trim() || null,
      start_time: input.all_day ? null : input.start_time,
      end_time: input.all_day ? null : input.end_time,
      ...(choices.length > 0 && { member_id: person }),
    }
    if (event) update.mutate({ id: event.key, input: payload }, { onSuccess: onClose })
    else if (calendarId) {
      create.mutate({ ...payload, calendar_id: calendarId }, { onSuccess: onClose })
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(clickEvent) => clickEvent.stopPropagation()}
        className="flex max-h-full w-full max-w-xl flex-col gap-4 overflow-y-auto rounded-3xl bg-white p-6 shadow-xl"
      >
        <h2 id={titleId} className="text-3xl font-extrabold text-slate-800">
          {t(event ? 'calendar.edit_event' : 'calendar.new_event')}
        </h2>
        {event?.recurring && (
          <p className="text-lg font-semibold text-amber-800">{t('calendar.edit_series_hint')}</p>
        )}
        <TextField
          label={t('calendar.event_title')}
          value={input.title}
          onChange={(changeEvent) => change({ title: changeEvent.target.value })}
          maxLength={500}
          required
          autoFocus
        />
        {!event && (
          <div className="flex flex-col gap-1.5 text-left">
            <label htmlFor={calendarFieldId} className="text-base font-bold text-slate-700">
              {t('calendar.event_calendar')}
            </label>
            <select
              id={calendarFieldId}
              value={calendarId}
              onChange={(changeEvent) => setCalendarId(Number(changeEvent.target.value))}
              className="min-h-14 rounded-2xl border-2 border-slate-200 bg-white px-4 text-lg outline-none focus:border-orange-400"
            >
              {calendars.map((calendar) => (
                <option key={calendar.id} value={calendar.id}>
                  {calendar.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {choices.length > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-base font-bold text-slate-700">
              {t('calendar.event_person')}
            </legend>
            <div className="flex flex-wrap gap-2">
              {choices.map((choice) => {
                const member = members.find((item) => item.id === choice)
                return (
                  <OwnerOption
                    key={choice ?? 'family'}
                    name="event-person"
                    label={member?.name ?? t('calendar.family')}
                    checked={person === choice}
                    onSelect={() => setChosen(choice)}
                  >
                    {member ? (
                      <Avatar
                        name={member.name}
                        color={member.color}
                        src={member.avatar_url}
                        size="xs"
                      />
                    ) : (
                      <FamilyAvatar color={familyColor} size="xs" />
                    )}
                  </OwnerOption>
                )
              })}
            </div>
          </fieldset>
        )}
        <Switch
          checked={input.all_day}
          onChange={(all_day) => change({ all_day })}
          label={t('calendar.event_all_day')}
          showLabel
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={t('calendar.event_start_date')}
            type="date"
            value={input.start_date}
            onChange={(changeEvent) => startDate(changeEvent.target.value)}
            required
          />
          {!input.all_day && (
            <TextField
              label={t('calendar.event_start_time')}
              type="time"
              value={input.start_time ?? ''}
              onChange={(changeEvent) => change({ start_time: changeEvent.target.value })}
              required
            />
          )}
          <TextField
            label={t(input.all_day ? 'calendar.event_last_day' : 'calendar.event_end_date')}
            type="date"
            value={input.end_date}
            onChange={(changeEvent) => change({ end_date: changeEvent.target.value })}
            required
          />
          {!input.all_day && (
            <TextField
              label={t('calendar.event_end_time')}
              type="time"
              value={input.end_time ?? ''}
              onChange={(changeEvent) => change({ end_time: changeEvent.target.value })}
              required
            />
          )}
        </div>
        <TextField
          label={t('calendar.location')}
          value={input.location ?? ''}
          onChange={(changeEvent) => change({ location: changeEvent.target.value })}
          maxLength={500}
        />
        <TextAreaField
          label={t('calendar.description')}
          value={input.description ?? ''}
          onChange={(changeEvent) => change({ description: changeEvent.target.value })}
          maxLength={4000}
        />
        {endsBeforeStart && <Alert>{t('errors.validation.invalid_event_times')}</Alert>}
        {saving.isError && <Alert>{errorMessage(t, saving.error)}</Alert>}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={saving.isPending || endsBeforeStart}>
            {t('actions.save')}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            {t('actions.cancel')}
          </Button>
        </div>
      </form>
    </div>
  )
}
