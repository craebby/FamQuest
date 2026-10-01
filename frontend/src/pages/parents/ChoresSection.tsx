import { useTranslation } from 'react-i18next'
import WandIcon from '~icons/fluent-emoji-flat/sparkles'
import PencilIcon from '~icons/lucide/pencil'
import PlusIcon from '~icons/lucide/plus'

import {
  type Chore,
  type ChorePlan,
  type ChoreRoom,
  choreData,
  updateChore,
  useChoresMutation,
} from '../../api/chores'
import { LEVEL_COLORS, byUrgency, intervalText, statusText } from '../../chores'
import { TaskIcon } from '../../components/TaskIcon'
import { Alert, Button, Section, Switch } from '../../components/ui'
import { errorMessage } from '../../errors'

interface ChoresSectionProps {
  plan: ChorePlan | undefined
  error: unknown
  onWizard: () => void
  onAddRoom: () => void
  onEditRoom: (room: ChoreRoom) => void
  onAddChore: (room: ChoreRoom) => void
  onEditChore: (chore: Chore) => void
}

/** Putzplan verwalten: Räume mit ihren Aufgaben und Abständen; der Assistent schlägt beides vor. */
export function ChoresSection({
  plan,
  error,
  onWizard,
  onAddRoom,
  onEditRoom,
  onAddChore,
  onEditChore,
}: ChoresSectionProps) {
  const { t } = useTranslation()
  const toggleActive = useChoresMutation((chore: Chore) =>
    updateChore(chore.id, { ...choreData(chore), active: !chore.active }),
  )
  const rooms = plan?.rooms ?? []

  return (
    <>
      <Section title={t('chores.section')}>
        {error ? <Alert>{errorMessage(t, error)}</Alert> : null}
        {toggleActive.isError && <Alert>{errorMessage(t, toggleActive.error)}</Alert>}
        <p className="text-lg text-slate-600">
          {t(rooms.length === 0 ? 'chores.section_empty' : 'chores.section_intro')}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button onClick={onWizard} disabled={plan === undefined}>
            <WandIcon className="size-7" aria-hidden="true" />
            {t('chores.wizard_start')}
          </Button>
          <Button variant="secondary" onClick={onAddRoom} disabled={plan === undefined}>
            <PlusIcon className="size-6" aria-hidden="true" />
            {t('chores.add_room')}
          </Button>
        </div>
      </Section>

      {rooms.map((room) => {
        const chores = (plan?.chores ?? [])
          .filter((chore) => chore.room_id === room.id)
          .sort((a, b) => a.interval_days - b.interval_days || byUrgency(a, b))
        return (
          <Section key={room.id} title={room.name}>
            {chores.length === 0 && (
              <p className="text-lg text-slate-600">{t('chores.room_empty')}</p>
            )}
            {chores.length > 0 && (
              <ul className="flex flex-col gap-3">
                {chores.map((chore) => (
                  <li
                    key={chore.id}
                    className={`flex items-center gap-3 rounded-2xl border-2 border-slate-100 p-2 sm:p-3 ${chore.active ? '' : 'bg-slate-50'}`}
                  >
                    <button
                      type="button"
                      onClick={() => onEditChore(chore)}
                      aria-label={t('chores.edit_title', { title: chore.title })}
                      className="flex min-w-0 flex-1 items-center gap-4 rounded-xl p-1 text-left transition-colors hover:bg-orange-50 focus-visible:outline-4 focus-visible:outline-orange-400 active:bg-orange-100"
                    >
                      <TaskIcon
                        icon={chore.icon}
                        className={`size-14 ${chore.active ? '' : 'opacity-40'}`}
                      />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-lg font-bold break-words text-slate-800">
                          {chore.title}
                          {!chore.active && (
                            <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-sm font-bold text-slate-600">
                              {t('chores.paused')}
                            </span>
                          )}
                        </span>
                        <span className="text-base text-slate-600">
                          {intervalText(t, chore.interval_days)}
                        </span>
                      </span>
                      {chore.active && (
                        <span
                          className={`shrink-0 text-right text-base font-bold ${chore.done_today ? 'text-slate-500' : LEVEL_COLORS[chore.level].text}`}
                        >
                          {statusText(t, chore)}
                        </span>
                      )}
                    </button>
                    <Switch
                      checked={chore.active}
                      onChange={() => toggleActive.mutate(chore)}
                      disabled={toggleActive.isPending && toggleActive.variables?.id === chore.id}
                      label={t('chores.active_toggle', { title: chore.title })}
                    />
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => onAddChore(room)}>
                <PlusIcon className="size-6" aria-hidden="true" />
                {t('chores.add_chore')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => onEditRoom(room)}
                aria-label={t('chores.edit_room', { name: room.name })}
              >
                <PencilIcon className="size-6" aria-hidden="true" />
                {t('chores.edit_room_short')}
              </Button>
            </div>
          </Section>
        )
      })}
    </>
  )
}
