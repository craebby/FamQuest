import { type FormEvent, useLayoutEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import BackIcon from '~icons/fluent-emoji-flat/left-arrow'
import LockedIcon from '~icons/fluent-emoji-flat/locked'
import UnlockedIcon from '~icons/fluent-emoji-flat/unlocked'

import {
  type Me,
  useDisablePin,
  useLockParent,
  useLogout,
  useMe,
  useResetPin,
  useSetPin,
  useUnlockParent,
} from '../api/auth'
import { type Member, childrenOf, useMembers } from '../api/members'
import { type Reward, useRewards } from '../api/rewards'
import { type Task, useTasks } from '../api/tasks'
import { useToday } from '../api/today'
import { PinPad } from '../components/PinPad'
import { Alert, Button, CenteredCard, Section, TextField } from '../components/ui'
import { errorMessage } from '../errors'
import { useIdleTimeout } from '../useIdleTimeout'
import { ApprovalsSection } from './parents/ApprovalsSection'
import { DeviceSection } from './parents/DeviceSection'
import { FamilySection } from './parents/FamilySection'
import { MemberEditor } from './parents/MemberEditor'
import { MembersSection } from './parents/MembersSection'
import { PointsEditor } from './parents/PointsEditor'
import { PointsSection } from './parents/PointsSection'
import { RewardEditor } from './parents/RewardEditor'
import { RewardPoolPicker } from './parents/RewardPoolPicker'
import { RewardsSection } from './parents/RewardsSection'
import { TaskEditor } from './parents/TaskEditor'
import { TasksSection } from './parents/TasksSection'

/** Nach dieser Zeit ohne Eingabe kehrt das Display zur Familienansicht zurück. */
export const PARENT_IDLE_TIMEOUT_MS = 2 * 60 * 1000

export function ParentsPage() {
  const { data: me } = useMe()
  const navigate = useNavigate()
  const lock = useLockParent()

  const leave = () => {
    lock.mutate()
    navigate('/')
  }
  useIdleTimeout(PARENT_IDLE_TIMEOUT_MS, leave)

  if (!me) return null
  return me.parent_unlocked ? (
    <ParentSettings me={me} onLeave={leave} />
  ) : (
    <ParentGate onLeave={leave} />
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation()
  return (
    <Button variant="secondary" onClick={onClick} className="self-start">
      <BackIcon className="size-8" aria-hidden="true" />
      {t('parents.back')}
    </Button>
  )
}

/** PIN-Abfrage vor dem Elternbereich, inkl. „PIN vergessen“. */
function ParentGate({ onLeave }: { onLeave: () => void }) {
  const { t } = useTranslation()
  const unlock = useUnlockParent()
  const [forgotten, setForgotten] = useState(false)

  if (forgotten) return <PinReset onCancel={() => setForgotten(false)} />

  return (
    <CenteredCard>
      <BackButton onClick={onLeave} />
      <LockedIcon className="mx-auto size-12" aria-hidden="true" />
      <PinPad
        title={t('parents.pin_prompt')}
        onSubmit={(pin) => unlock.mutate(pin)}
        error={unlock.isError ? errorMessage(t, unlock.error) : undefined}
        busy={unlock.isPending}
      />
      <Button variant="secondary" onClick={() => setForgotten(true)}>
        {t('parents.forgot_pin')}
      </Button>
    </CenteredCard>
  )
}

function PinReset({ onCancel }: { onCancel: () => void }) {
  const { t } = useTranslation()
  const reset = useResetPin()
  const [password, setPassword] = useState('')
  const [passwordConfirmed, setPasswordConfirmed] = useState(false)

  if (passwordConfirmed) {
    return (
      <CenteredCard>
        <NewPinFlow
          busy={reset.isPending}
          onDone={(pin) =>
            reset.mutate({ password, pin }, { onError: () => setPasswordConfirmed(false) })
          }
          onCancel={() => setPasswordConfirmed(false)}
        />
      </CenteredCard>
    )
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (password) setPasswordConfirmed(true)
  }

  return (
    <CenteredCard>
      <h1 className="text-2xl font-extrabold text-slate-800">{t('parents.reset_title')}</h1>
      <p className="text-lg text-slate-600">{t('parents.reset_intro')}</p>
      <form className="flex flex-col gap-4" onSubmit={submit}>
        {reset.isError && <Alert>{errorMessage(t, reset.error)}</Alert>}
        <TextField
          label={t('parents.password')}
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />
        <Button type="submit">{t('actions.next')}</Button>
        <Button variant="secondary" onClick={onCancel}>
          {t('actions.cancel')}
        </Button>
      </form>
    </CenteredCard>
  )
}

/** Neue PIN zweimal eingeben lassen. */
function NewPinFlow({
  onDone,
  onCancel,
  busy,
}: {
  onDone: (pin: string) => void
  onCancel: () => void
  busy: boolean
}) {
  const { t } = useTranslation()
  const [firstPin, setFirstPin] = useState<string | null>(null)
  const [mismatch, setMismatch] = useState(false)

  const submit = (pin: string) => {
    if (firstPin === null) {
      setFirstPin(pin)
      setMismatch(false)
    } else if (pin === firstPin) {
      onDone(pin)
    } else {
      setFirstPin(null)
      setMismatch(true)
    }
  }

  return (
    <>
      <PinPad
        key={firstPin === null ? 'new' : 'repeat'}
        title={t(firstPin === null ? 'parents.new_pin' : 'parents.repeat_pin')}
        onSubmit={submit}
        error={mismatch ? errorMessage(t, 'pin.mismatch') : undefined}
        busy={busy}
      />
      <Button variant="secondary" onClick={onCancel} disabled={busy}>
        {t('actions.cancel')}
      </Button>
    </>
  )
}

function ParentSettings({ me, onLeave }: { me: Me; onLeave: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const setPin = useSetPin()
  const disablePin = useDisablePin()
  const logout = useLogout()
  const members = useMembers()
  const tasks = useTasks()
  const today = useToday()
  const rewards = useRewards()
  const [editingPin, setEditingPin] = useState(false)
  const [editingMember, setEditingMember] = useState<Member | 'new' | null>(null)
  const [editingTask, setEditingTask] = useState<Task | 'new' | null>(null)
  const [pointsMember, setPointsMember] = useState<Member | null>(null)
  const [taskFilter, setTaskFilter] = useState<number | null>(null)
  const [rewardsChildId, setRewardsChildId] = useState<number | null>(null)
  const [editingReward, setEditingReward] = useState<{ reward?: Reward; member: Member } | null>(
    null,
  )
  const [poolMember, setPoolMember] = useState<Member | null>(null)

  // Jede Unteransicht (Editor, Vorschläge, Punkte, PIN) beginnt oben, nicht an der Stelle,
  // an der man in der Übersicht gerade war.
  const view = editingMember
    ? 'member'
    : editingTask
      ? 'task'
      : editingReward
        ? 'reward'
        : poolMember
          ? 'pool'
          : pointsMember
            ? 'points'
            : editingPin
              ? 'pin'
              : 'overview'
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [view])
  const [confirmDisable, setConfirmDisable] = useState(false)
  const [notice, setNotice] = useState<string>()

  if (editingMember) {
    const closeWith = (message: string) => {
      setEditingMember(null)
      setNotice(message)
    }
    return (
      <MemberEditor
        member={editingMember === 'new' ? undefined : editingMember}
        members={members.data ?? []}
        onSaved={(name) => closeWith(t('members.saved', { name }))}
        onDeleted={(name) => closeWith(t('members.deleted', { name }))}
        onCancel={() => setEditingMember(null)}
      />
    )
  }

  if (editingTask) {
    const closeWith = (message: string) => {
      setEditingTask(null)
      setNotice(message)
    }
    return (
      <TaskEditor
        task={editingTask === 'new' ? undefined : editingTask}
        members={members.data ?? []}
        initialMemberIds={taskFilter === null ? [] : [taskFilter]}
        timeZone={me.family.timezone}
        onSaved={(title) => closeWith(t('tasks.saved', { title }))}
        onDeleted={(title) => closeWith(t('tasks.deleted', { title }))}
        onCancel={() => setEditingTask(null)}
      />
    )
  }

  const childMembers = childrenOf(members.data ?? [])
  const rewardsChild =
    childMembers.find((member) => member.id === rewardsChildId) ?? childMembers[0]

  if (editingReward) {
    const closeWith = (message: string) => {
      setEditingReward(null)
      setNotice(message)
    }
    return (
      <RewardEditor
        reward={editingReward.reward}
        member={editingReward.member}
        onSaved={(name) => closeWith(t('rewards.saved', { name }))}
        onDeleted={(name) => closeWith(t('rewards.deleted', { name }))}
        onCancel={() => setEditingReward(null)}
      />
    )
  }

  if (poolMember) {
    return (
      <RewardPoolPicker
        member={poolMember}
        existing={(rewards.data ?? []).filter((reward) => reward.member_id === poolMember.id)}
        onDone={(count) => {
          setPoolMember(null)
          setNotice(t('rewards.pool_added', { count, name: poolMember.name }))
        }}
        onCancel={() => setPoolMember(null)}
      />
    )
  }

  if (pointsMember) {
    return (
      <PointsEditor
        member={pointsMember}
        timeZone={me.family.timezone}
        onBack={() => setPointsMember(null)}
      />
    )
  }

  if (editingPin) {
    return (
      <CenteredCard>
        {setPin.isError && <Alert>{errorMessage(t, setPin.error)}</Alert>}
        <NewPinFlow
          busy={setPin.isPending}
          onDone={(pin) =>
            setPin.mutate(pin, {
              onSuccess: () => {
                setEditingPin(false)
                setNotice(t('parents.pin_saved'))
              },
            })
          }
          onCancel={() => setEditingPin(false)}
        />
      </CenteredCard>
    )
  }

  const pinEnabled = me.family.pin_enabled
  const PinStatusIcon = pinEnabled ? LockedIcon : UnlockedIcon

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <BackButton onClick={onLeave} />
      <h1 className="text-3xl font-extrabold text-orange-600">{t('parents.title')}</h1>
      {notice && (
        <p
          role="status"
          className="rounded-2xl bg-emerald-100 px-4 py-3 text-lg font-semibold text-emerald-800"
        >
          {notice}
        </p>
      )}
      {disablePin.isError && <Alert>{errorMessage(t, disablePin.error)}</Alert>}

      <ApprovalsSection members={members.data ?? []} today={today.data?.date} />

      <MembersSection
        members={members.data}
        error={members.error}
        onEdit={(member) => {
          setNotice(undefined)
          setEditingMember(member)
        }}
        onAdd={() => {
          setNotice(undefined)
          setEditingMember('new')
        }}
      />

      <TasksSection
        tasks={tasks.data}
        members={members.data ?? []}
        error={tasks.error}
        filter={taskFilter}
        onFilter={setTaskFilter}
        onEdit={(task) => {
          setNotice(undefined)
          setEditingTask(task)
        }}
        onAdd={() => {
          setNotice(undefined)
          setEditingTask('new')
        }}
      />

      <PointsSection
        members={members.data ?? []}
        today={today.data}
        error={today.error}
        onOpen={(member) => {
          setNotice(undefined)
          setPointsMember(member)
        }}
      />

      <RewardsSection
        childMembers={childMembers}
        rewards={rewards.data}
        error={rewards.error}
        member={rewardsChild}
        onSelect={setRewardsChildId}
        onEdit={(reward) => {
          const member = childMembers.find((child) => child.id === reward.member_id)
          if (!member) return
          setNotice(undefined)
          setEditingReward({ reward, member })
        }}
        onAdd={(member) => {
          setNotice(undefined)
          setEditingReward({ member })
        }}
        onPickFromPool={(member) => {
          setNotice(undefined)
          setPoolMember(member)
        }}
        timeZone={me.family.timezone}
      />

      <FamilySection me={me} onSaved={setNotice} />

      <Section title={t('parents.pin_section')}>
        <p className="flex items-center gap-3 text-lg text-slate-600">
          <PinStatusIcon className="size-10 shrink-0" aria-hidden="true" />
          {t(pinEnabled ? 'parents.pin_on' : 'parents.pin_off')}
        </p>
        {confirmDisable ? (
          <div className="flex flex-col gap-3 rounded-2xl bg-red-50 p-4">
            <p className="text-lg font-semibold text-red-800">{t('parents.disable_confirm')}</p>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="danger"
                disabled={disablePin.isPending}
                onClick={() =>
                  disablePin.mutate(undefined, {
                    onSuccess: () => {
                      setConfirmDisable(false)
                      setNotice(t('parents.pin_disabled'))
                    },
                  })
                }
              >
                {t('parents.disable_pin')}
              </Button>
              <Button variant="secondary" onClick={() => setConfirmDisable(false)}>
                {t('actions.cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setEditingPin(true)}>
              {t(pinEnabled ? 'parents.change_pin' : 'parents.enable_pin')}
            </Button>
            {pinEnabled && (
              <Button variant="danger" onClick={() => setConfirmDisable(true)}>
                {t('parents.disable_pin')}
              </Button>
            )}
          </div>
        )}
      </Section>

      <DeviceSection />

      <Section title={t('parents.account_section')}>
        <p className="text-lg text-slate-600">
          {t('parents.signed_in_as', { email: me.user.email })}
        </p>
        <Button
          variant="secondary"
          className="self-start"
          disabled={logout.isPending}
          onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/login') })}
        >
          {t('actions.logout')}
        </Button>
      </Section>
    </main>
  )
}
