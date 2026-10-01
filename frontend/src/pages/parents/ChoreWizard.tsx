import { useLayoutEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ApartmentIcon from '~icons/fluent-emoji-flat/office-building'
import HouseIcon from '~icons/fluent-emoji-flat/house-with-garden'
import CheckIcon from '~icons/lucide/check'

import { type ChorePlan, setupChores, useChoresMutation } from '../../api/chores'
import { intervalText } from '../../chores'
import { TaskIcon } from '../../components/TaskIcon'
import { Alert, Button, Switch } from '../../components/ui'
import { errorMessage } from '../../errors'
import { normalize } from '../../icons/catalog'
import {
  DEFAULT_PROFILE,
  type HomeProfile,
  MAX_BATHROOMS,
  PACES,
  PROFILE_SWITCHES,
  suggestPlan,
} from '../../pools/chores'
import { ChoiceTile, Field, NumberStepper } from './formParts'

interface ChoreWizardProps {
  /** Vorhandener Putzplan; gleichnamige Aufgaben im gleichnamigen Raum sind schon abgehakt. */
  plan: ChorePlan
  /** Familie mit Kindern: Das Kinderzimmer ist vorgewählt. */
  hasChildren: boolean
  onDone: (result: { rooms: number; chores: number }) => void
  onCancel: () => void
}

const HOME_ICONS = { flat: ApartmentIcon, house: HouseIcon }

/**
 * Einrichtungs-Assistent: ein paar Fragen zum Zuhause, daraus ein Vorschlag für Räume, Aufgaben
 * und Abstände. Angehakt ist nur das Mindeste, der Rest lässt sich dazuwählen und später ändern.
 */
export function ChoreWizard({ plan, hasChildren, onDone, onCancel }: ChoreWizardProps) {
  const { t } = useTranslation()
  const [profile, setProfile] = useState<HomeProfile>({ ...DEFAULT_PROFILE, kids: hasChildren })
  const [step, setStep] = useState<'questions' | 'review'>('questions')
  // Umgeschaltete Vorschläge (Schlüssel „raum.aufgabe“): Vorgewähltes abgewählt, anderes dazugewählt.
  const [toggled, setToggled] = useState<string[]>([])
  const add = useChoresMutation(setupChores)

  // Der Vorschlag beginnt oben, nicht auf Höhe des Knopfs, der zu ihm geführt hat.
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [step])

  const set = <K extends keyof HomeProfile>(key: K, value: HomeProfile[K]) =>
    setProfile((current) => ({ ...current, [key]: value }))

  const existing = new Set(
    plan.chores.map((chore) => {
      const room = plan.rooms.find((candidate) => candidate.id === chore.room_id)
      return `${normalize(room?.name ?? '')}/${normalize(chore.title)}`
    }),
  )
  const rooms = suggestPlan(t, profile).map((room) => ({
    ...room,
    chores: room.chores.map((chore) => ({
      ...chore,
      present: existing.has(`${normalize(room.name)}/${normalize(chore.title)}`),
      selected: chore.preselected !== toggled.includes(chore.key),
    })),
  }))
  const chosen = rooms
    .map((room) => ({
      name: room.name,
      icon: room.icon,
      chores: room.chores
        .filter((chore) => !chore.present && chore.selected)
        .map(({ title, icon, interval_days }) => ({ title, icon, interval_days })),
    }))
    .filter((room) => room.chores.length > 0)
  const count = chosen.reduce((sum, room) => sum + room.chores.length, 0)

  const toggle = (key: string) =>
    setToggled((keys) =>
      keys.includes(key) ? keys.filter((item) => item !== key) : [...keys, key],
    )

  if (step === 'questions') {
    return (
      <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 p-4 sm:p-6">
        <h1 className="text-3xl font-extrabold text-orange-600">{t('chores.wizard_title')}</h1>
        <p className="text-lg text-slate-600">{t('chores.wizard_intro')}</p>

        <section className="flex flex-col gap-6 rounded-3xl bg-white p-6 shadow-sm">
          <Field label={t('chores.wizard_home')}>
            <div className="grid grid-cols-2 gap-3">
              {(['flat', 'house'] as const).map((home) => {
                const Icon = HOME_ICONS[home]
                return (
                  <ChoiceTile
                    key={home}
                    name="chore-home"
                    checked={profile.home === home}
                    onChange={() => set('home', home)}
                  >
                    <Icon className="size-12" aria-hidden="true" />
                    {t(`chores.wizard_home_${home}`)}
                  </ChoiceTile>
                )
              })}
            </div>
          </Field>

          <Field label={t('chores.wizard_bathrooms')}>
            <NumberStepper
              label={t('chores.wizard_bathrooms')}
              value={profile.bathrooms}
              min={1}
              max={MAX_BATHROOMS}
              onChange={(bathrooms) => set('bathrooms', bathrooms)}
              decreaseLabel={t('chores.wizard_fewer_bathrooms')}
              increaseLabel={t('chores.wizard_more_bathrooms')}
            />
            <p className="text-base text-slate-500">{t('chores.wizard_bathrooms_hint')}</p>
          </Field>

          <Field label={t('chores.wizard_extras')}>
            <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {PROFILE_SWITCHES.map((key) => (
                <Switch
                  key={key}
                  checked={profile[key]}
                  onChange={(checked) => set(key, checked)}
                  label={t(`chores.wizard_${key}`)}
                  showLabel
                />
              ))}
            </div>
          </Field>

          <Field label={t('chores.wizard_pace')}>
            <div className="grid grid-cols-3 gap-3">
              {PACES.map((pace) => (
                <ChoiceTile
                  key={pace}
                  name="chore-pace"
                  checked={profile.pace === pace}
                  onChange={() => set('pace', pace)}
                >
                  {t(`chores.wizard_pace_${pace}`)}
                  <span className="text-sm font-normal text-slate-500">
                    {t(`chores.wizard_pace_${pace}_hint`)}
                  </span>
                </ChoiceTile>
              ))}
            </div>
          </Field>
        </section>

        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setStep('review')}>{t('chores.wizard_show')}</Button>
          <Button variant="secondary" onClick={onCancel}>
            {t('actions.cancel')}
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-6 p-4 pb-32 sm:p-6 sm:pb-32">
      <h1 className="text-3xl font-extrabold text-orange-600">{t('chores.wizard_review_title')}</h1>
      <p className="text-lg text-slate-600">{t('chores.wizard_review_intro')}</p>
      {add.isError && <Alert>{errorMessage(t, add.error)}</Alert>}

      {rooms.map((room) => (
        <section
          key={room.key}
          aria-labelledby={`wizard-room-${room.key}`}
          className="flex flex-col gap-3 rounded-3xl bg-white p-4 shadow-sm sm:p-6"
        >
          <h2
            id={`wizard-room-${room.key}`}
            className="flex items-center gap-2 text-2xl font-extrabold text-slate-800"
          >
            <TaskIcon icon={room.icon} className="size-9" />
            {room.name}
          </h2>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-3">
            {room.chores.map((chore) => {
              const checked = chore.present || chore.selected
              return (
                <li key={chore.key}>
                  <label className={chore.present ? 'cursor-not-allowed' : 'cursor-pointer'}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={chore.present || add.isPending}
                      onChange={() => toggle(chore.key)}
                      className="peer sr-only"
                    />
                    <span className="relative flex h-full items-center gap-3 rounded-2xl border-2 border-slate-200 p-3 pr-10 peer-checked:border-orange-500 peer-checked:bg-orange-50 peer-focus-visible:outline-4 peer-focus-visible:outline-orange-400 peer-disabled:opacity-60">
                      {checked && (
                        <span className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-orange-500 text-white">
                          <CheckIcon className="size-5" strokeWidth={4} aria-hidden="true" />
                        </span>
                      )}
                      <TaskIcon icon={chore.icon} className="size-12" />
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="text-lg leading-tight font-bold break-words hyphens-auto text-slate-800">
                          {chore.title}
                        </span>
                        <span className="text-base text-slate-600">
                          {intervalText(t, chore.interval_days)}
                        </span>
                        {chore.present && (
                          <span className="text-sm font-bold text-slate-500">
                            {t('rewards.pool_present')}
                          </span>
                        )}
                      </span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      <div className="fixed inset-x-0 bottom-0 z-10 flex flex-wrap justify-center gap-3 border-t border-orange-100 bg-white/95 p-4 backdrop-blur">
        <Button
          onClick={() => add.mutate(chosen, { onSuccess: onDone })}
          disabled={count === 0 || add.isPending}
        >
          {t('chores.wizard_add', { count })}
        </Button>
        <Button variant="secondary" onClick={() => setStep('questions')} disabled={add.isPending}>
          {t('actions.back')}
        </Button>
      </div>
    </main>
  )
}
