import { type ReactNode, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import BroomIcon from '~icons/fluent-emoji-flat/broom'
import CheckIcon from '~icons/fluent-emoji-flat/check-mark-button'
import CloseIcon from '~icons/lucide/x'

import {
  CHORE_LEVELS,
  type Chore,
  type ChoreRoom,
  useChores,
  useMarkDone,
  useUndoDone,
} from '../api/chores'
import { type Member, useMembers } from '../api/members'
import { LEVEL_COLORS, byUrgency, groupByLevel, intervalText, statusText } from '../chores'
import { Avatar } from '../components/Avatar'
import { TaskIcon } from '../components/TaskIcon'
import { Alert, Button } from '../components/ui'
import { errorMessage } from '../errors'
import { areaPath } from './parents/areas'

/** So lange bleibt die Frage „Wer war's?“ nach dem Erledigen stehen. */
export const WHO_TIMEOUT_MS = 12 * 1000

type Grouping = 'urgency' | 'rooms'

/**
 * Putzplan: jede Hausarbeit mit Ampel statt festem Termin. Ein Tipp erledigt und stellt die Uhr
 * zurück; danach lässt sich freiwillig antippen, wer es war. Ohne Eltern-PIN.
 */
export function ChoresPage() {
  const { t } = useTranslation()
  const plan = useChores()
  const members = useMembers()
  const markDone = useMarkDone()
  const undoDone = useUndoDone()
  const [grouping, setGrouping] = useState<Grouping>('urgency')
  // Gerade erledigte Aufgabe, zu der noch gefragt wird, wer es war.
  const [askingId, setAskingId] = useState<number | null>(null)

  useEffect(() => {
    if (askingId === null) return
    const timer = window.setTimeout(() => setAskingId(null), WHO_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [askingId])

  const rooms = plan.data?.rooms ?? []
  const chores = (plan.data?.chores ?? []).filter((chore) => chore.active)
  const roomOf = (chore: Chore) => rooms.find((room) => room.id === chore.room_id)
  const asking = chores.find((chore) => chore.id === askingId && chore.done_today)
  const error = markDone.error ?? undoDone.error

  const toggle = (chore: Chore) => {
    if (chore.done_today) {
      setAskingId(null)
      undoDone.mutate(chore.id)
    } else {
      markDone.mutate({ id: chore.id, memberId: null }, { onSuccess: () => setAskingId(chore.id) })
    }
  }

  const row = (chore: Chore, showRoom: boolean) => (
    <ChoreRow
      key={chore.id}
      chore={chore}
      room={showRoom ? roomOf(chore) : undefined}
      doneBy={members.data?.find((member) => member.id === chore.done_by)}
      onToggle={() => toggle(chore)}
    />
  )

  return (
    <main className="flex flex-1 flex-col gap-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-extrabold text-orange-600">{t('chores.title')}</h1>
        {chores.length > 0 && (
          <div
            role="group"
            aria-label={t('chores.grouping')}
            className="ml-auto flex rounded-2xl bg-white p-1 shadow-sm"
          >
            {(['urgency', 'rooms'] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={grouping === value}
                onClick={() => setGrouping(value)}
                className="min-h-12 rounded-xl px-4 text-lg font-bold text-slate-600 focus-visible:outline-4 focus-visible:outline-orange-400 aria-pressed:bg-orange-500 aria-pressed:text-white"
              >
                {t(`chores.grouping_${value}`)}
              </button>
            ))}
          </div>
        )}
      </header>

      {error ? <Alert>{errorMessage(t, error)}</Alert> : null}

      {plan.isPending ? (
        <p role="status" className="text-xl text-slate-600">
          {t('common.loading')}
        </p>
      ) : !plan.data ? (
        <div className="flex flex-col items-start gap-4">
          <Alert>{errorMessage(t, plan.error)}</Alert>
          <Button onClick={() => void plan.refetch()}>{t('actions.retry')}</Button>
        </div>
      ) : chores.length === 0 ? (
        <Link
          to={areaPath('household')}
          className="flex flex-col items-center gap-3 rounded-3xl border-4 border-dashed border-slate-200 p-8 text-center hover:bg-white focus-visible:outline-4 focus-visible:outline-orange-400"
        >
          <BroomIcon className="size-24" aria-hidden="true" />
          <span className="text-2xl font-extrabold text-slate-700">{t('chores.empty')}</span>
          <span className="text-lg text-slate-500">{t('chores.empty_hint')}</span>
        </Link>
      ) : grouping === 'urgency' ? (
        <ByUrgency chores={chores} row={(chore) => row(chore, true)} />
      ) : (
        rooms.map((room) => (
          <RoomGroup
            key={room.id}
            room={room}
            chores={chores.filter((chore) => chore.room_id === room.id)}
            row={(chore) => row(chore, false)}
          />
        ))
      )}

      {asking && (
        <WhoBar
          chore={asking}
          members={members.data ?? []}
          onPick={(member) => {
            markDone.mutate({ id: asking.id, memberId: member.id })
            setAskingId(null)
          }}
          onUndo={() => toggle(asking)}
          onClose={() => setAskingId(null)}
        />
      )}
    </main>
  )
}

const LIST_CLASS = 'grid grid-cols-[repeat(auto-fill,minmax(20rem,1fr))] gap-3'

/** Nach Ampel: erst was fällig ist, dann was bald dran ist, dann der Rest; unten heute Erledigtes. */
function ByUrgency({ chores, row }: { chores: Chore[]; row: (chore: Chore) => ReactNode }) {
  const { t } = useTranslation()
  const groups = groupByLevel(chores)
  const done = chores.filter((chore) => chore.done_today).sort(byUrgency)
  const nothingUrgent = groups.due.length === 0 && groups.soon.length === 0

  return (
    <>
      {nothingUrgent && (
        <p className="flex items-center gap-3 rounded-3xl bg-emerald-50 p-4 text-xl font-bold text-emerald-800">
          <CheckIcon className="size-10 shrink-0" aria-hidden="true" />
          {t('chores.all_good')}
        </p>
      )}
      {CHORE_LEVELS.map(
        (level) =>
          groups[level].length > 0 && (
            <section
              key={level}
              aria-labelledby={`chores-${level}`}
              className="flex flex-col gap-3"
            >
              <h2
                id={`chores-${level}`}
                className={`flex items-center gap-2 text-2xl font-extrabold ${LEVEL_COLORS[level].text}`}
              >
                <span
                  aria-hidden="true"
                  className={`size-5 rounded-full ${LEVEL_COLORS[level].fill}`}
                />
                {t(`chores.level_${level}`)}
              </h2>
              <ul className={LIST_CLASS}>{groups[level].map(row)}</ul>
            </section>
          ),
      )}
      {done.length > 0 && (
        <section aria-labelledby="chores-done" className="flex flex-col gap-3">
          <h2 id="chores-done" className="text-2xl font-extrabold text-slate-500">
            {t('chores.done_title')}
          </h2>
          <ul className={LIST_CLASS}>{done.map(row)}</ul>
        </section>
      )}
    </>
  )
}

/** Ein Raum mit seinen Aufgaben, die dringendste zuerst, heute Erledigtes am Ende. */
function RoomGroup({
  room,
  chores,
  row,
}: {
  room: ChoreRoom
  chores: Chore[]
  row: (chore: Chore) => ReactNode
}) {
  if (chores.length === 0) return null
  const sorted = [...chores].sort(
    (a, b) => Number(a.done_today) - Number(b.done_today) || byUrgency(a, b),
  )
  return (
    <section aria-labelledby={`chore-room-${room.id}`} className="flex flex-col gap-3">
      <h2
        id={`chore-room-${room.id}`}
        className="flex items-center gap-2 text-2xl font-extrabold text-slate-800"
      >
        <TaskIcon icon={room.icon} className="size-9" />
        {room.name}
      </h2>
      <ul className={LIST_CLASS}>{sorted.map(row)}</ul>
    </section>
  )
}

/** Eine Hausarbeit als große Zeile; der Balken füllt sich, bis sie fällig ist. */
function ChoreRow({
  chore,
  room,
  doneBy,
  onToggle,
}: {
  chore: Chore
  /** Raum zur Anzeige unter dem Titel; fehlt, wenn die Zeile schon unter ihrem Raum steht. */
  room?: ChoreRoom
  doneBy?: Member
  onToggle: () => void
}) {
  const { t } = useTranslation()
  const colors = LEVEL_COLORS[chore.level]
  const interval = intervalText(t, chore.interval_days)

  return (
    <li
      className={`flex min-w-0 rounded-2xl bg-white p-1 shadow-sm ${chore.done_today ? 'opacity-60' : ''}`}
    >
      <button
        type="button"
        aria-pressed={chore.done_today}
        onClick={onToggle}
        className="flex min-h-24 min-w-0 flex-1 flex-col justify-center gap-2 rounded-xl p-2 text-left hover:bg-orange-50 focus-visible:outline-4 focus-visible:outline-orange-400 active:bg-orange-100"
      >
        <span className="flex min-w-0 items-center gap-3">
          {chore.done_today ? (
            <CheckIcon className="size-10 shrink-0" aria-hidden="true" />
          ) : (
            <span
              aria-hidden="true"
              className={`size-10 shrink-0 rounded-full ring-4 ring-white ${colors.fill}`}
            />
          )}
          <TaskIcon icon={chore.icon} className="size-14" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span
              className={`text-xl leading-tight font-bold break-words text-slate-800 ${chore.done_today ? 'line-through' : ''}`}
            >
              {chore.title}
            </span>
            <span className="text-base leading-tight break-words text-slate-500">
              {room ? `${room.name} · ${interval}` : interval}
            </span>
            <span
              className={`text-lg leading-tight font-bold ${chore.done_today ? 'text-slate-500' : colors.text}`}
            >
              {statusText(t, chore)}
            </span>
          </span>
          {chore.done_today && doneBy && (
            <Avatar
              name={doneBy.name}
              color={doneBy.color}
              src={doneBy.avatar_url}
              size="sm"
              label={t('chores.done_by', { name: doneBy.name })}
            />
          )}
        </span>
        {!chore.done_today && (
          <span aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-slate-100">
            <span
              className={`block h-full rounded-full ${colors.fill}`}
              style={{ width: `${Math.round(Math.min(chore.ratio, 1) * 100)}%` }}
            />
          </span>
        )}
      </button>
    </li>
  )
}

/** Nach dem Erledigen: freiwillig antippen, wer es war, oder den Tipp zurücknehmen. */
function WhoBar({
  chore,
  members,
  onPick,
  onUndo,
  onClose,
}: {
  chore: Chore
  members: Member[]
  onPick: (member: Member) => void
  onUndo: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  // Erwachsene zuerst; Kinder dürfen auch mithelfen.
  const sorted = [...members].sort(
    (a, b) => Number(a.role !== 'parent') - Number(b.role !== 'parent'),
  )
  return (
    <section
      aria-label={t('chores.who')}
      className="fixed inset-x-2 bottom-30 z-20 mx-auto flex max-w-3xl flex-wrap items-center gap-3 rounded-3xl bg-slate-800 p-3 text-white shadow-xl sm:bottom-4 sm:left-32"
    >
      <p role="status" className="min-w-0 flex-1 basis-48 text-lg font-bold break-words">
        {t('chores.done_notice', { title: chore.title })}{' '}
        {sorted.length > 0 && <span className="font-normal">{t('chores.who')}</span>}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {sorted.map((member) => (
          <button
            key={member.id}
            type="button"
            aria-label={member.name}
            title={member.name}
            onClick={() => onPick(member)}
            className="rounded-full focus-visible:outline-4 focus-visible:outline-orange-400"
          >
            <Avatar name={member.name} color={member.color} src={member.avatar_url} size="sm" />
          </button>
        ))}
        <button
          type="button"
          onClick={onUndo}
          className="min-h-12 rounded-2xl px-4 text-lg font-bold underline focus-visible:outline-4 focus-visible:outline-orange-400"
        >
          {t('chores.undo')}
        </button>
        <button
          type="button"
          aria-label={t('chores.who_close')}
          onClick={onClose}
          className="flex size-12 items-center justify-center rounded-2xl hover:bg-slate-700 focus-visible:outline-4 focus-visible:outline-orange-400"
        >
          <CloseIcon className="size-7" aria-hidden="true" />
        </button>
      </div>
    </section>
  )
}
