import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import PlusIcon from '~icons/fluent-emoji-flat/plus'

import { useMe } from '../../api/auth'
import type { CalendarWeek } from '../../api/calendar'
import { Button } from '../../components/ui'
import { PinDialog } from '../home/HomeEditor'
import { EventForm } from './EventForm'

/** Plus für einen neuen Termin mit Eltern-PIN; ohne Kalender mit Schreibzugriff nicht sichtbar. */
export function NewEventButton({ week, date }: { week: CalendarWeek; date: string }) {
  const { t } = useTranslation()
  const { data: me } = useMe()
  const [creating, setCreating] = useState<'pin' | 'form' | null>(null)

  if (week.writable_calendars.length === 0) return null
  return (
    <>
      <Button
        variant="secondary"
        aria-label={t('calendar.new_event')}
        title={t('calendar.new_event')}
        onClick={() => setCreating(me?.parent_unlocked ? 'form' : 'pin')}
        className="px-4"
      >
        <PlusIcon className="size-8" aria-hidden="true" />
      </Button>
      {creating === 'pin' && (
        <PinDialog
          label={t('calendar.new_event')}
          onUnlocked={() => setCreating('form')}
          onCancel={() => setCreating(null)}
        />
      )}
      {creating === 'form' && (
        <EventForm
          calendars={week.writable_calendars}
          date={date}
          timeZone={week.timezone}
          familyColor={week.family_color}
          onClose={() => setCreating(null)}
        />
      )}
    </>
  )
}
