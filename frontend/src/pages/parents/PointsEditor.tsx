import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import CheckIcon from '~icons/fluent-emoji-flat/check-mark-button'
import BackIcon from '~icons/fluent-emoji-flat/left-arrow'
import UndoIcon from '~icons/fluent-emoji-flat/counterclockwise-arrows-button'
import MinusCircleIcon from '~icons/fluent-emoji-flat/minus'
import PlusCircleIcon from '~icons/fluent-emoji-flat/plus'
import TrophyIcon from '~icons/fluent-emoji-flat/trophy'
import ManualIcon from '~icons/fluent-emoji-flat/writing-hand'
import MinusIcon from '~icons/lucide/minus'
import PlusIcon from '~icons/lucide/plus'

import { ApiError } from '../../api/client'
import type { Member } from '../../api/members'
import {
  MANUAL_MAX_POINTS,
  type PointKind,
  type PointTransaction,
  useBookPoints,
  usePointHistory,
} from '../../api/points'
import { Avatar } from '../../components/Avatar'
import { TaskIcon } from '../../components/TaskIcon'
import { Alert, Button, Section, TextField } from '../../components/ui'
import { errorMessage } from '../../errors'
import { ChoiceTile, Field } from './formParts'

const KIND_ICONS: Record<PointKind, typeof ManualIcon> = {
  task_completed: CheckIcon,
  task_undone: UndoIcon,
  manual: ManualIcon,
}

type Direction = 'credit' | 'deduct'

interface PointsEditorProps {
  member: Member
  /** Zeitzone der Familie für Datum und Uhrzeit der Buchungen. */
  timeZone: string
  onBack: () => void
}

/** Punktestand, Buchungshistorie und manuelle Buchung für eine Person. */
export function PointsEditor({ member, timeZone, onBack }: PointsEditorProps) {
  const { t } = useTranslation()
  const history = usePointHistory(member.id)
  const book = useBookPoints(member.id)
  const [direction, setDirection] = useState<Direction>('credit')
  const [amount, setAmount] = useState(1)
  const [reason, setReason] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [notice, setNotice] = useState<string>()

  const total = history.data?.pages[0]?.total
  const transactions = history.data?.pages.flatMap((page) => page.transactions) ?? []
  const reasonError =
    submitted && !reason.trim()
      ? errorMessage(t, 'validation.required')
      : book.error instanceof ApiError && book.error.fields.reason
        ? errorMessage(t, book.error.fields.reason)
        : undefined

  const setAmountClamped = (value: number) =>
    setAmount(Math.min(MANUAL_MAX_POINTS, Math.max(1, Number.isFinite(value) ? value : 1)))

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    setNotice(undefined)
    if (!reason.trim()) return
    book.mutate(
      { amount: direction === 'credit' ? amount : -amount, reason: reason.trim() },
      {
        onSuccess: () => {
          setNotice(
            t(direction === 'credit' ? 'points.credited' : 'points.deducted', {
              count: amount,
              name: member.name,
            }),
          )
          setAmount(1)
          setReason('')
          setSubmitted(false)
        },
      },
    )
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <Button variant="secondary" onClick={onBack} className="self-start">
        <BackIcon className="size-8" aria-hidden="true" />
        {t('actions.back')}
      </Button>
      <header className="flex flex-wrap items-center gap-4">
        <Avatar name={member.name} color={member.color} src={member.avatar_url} size="lg" />
        <h1 className="min-w-0 flex-1 text-3xl font-extrabold break-words text-orange-600">
          {t('points.open', { name: member.name })}
        </h1>
        <p className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2 shadow-sm">
          <TrophyIcon className="size-10" aria-hidden="true" />
          <span className="sr-only">{t('points.balance')}: </span>
          <span className="text-4xl font-extrabold text-slate-800 tabular-nums">
            {total ?? '–'}
          </span>
        </p>
      </header>

      {notice && (
        <p
          role="status"
          className="rounded-2xl bg-emerald-100 px-4 py-3 text-lg font-semibold text-emerald-800"
        >
          {notice}
        </p>
      )}

      <form
        className="flex flex-col gap-6 rounded-3xl bg-white p-6 shadow-sm"
        onSubmit={submit}
        noValidate
      >
        <h2 className="text-2xl font-extrabold text-slate-800">{t('points.book_title')}</h2>
        {book.isError && !(book.error instanceof ApiError && book.error.fields.reason) && (
          <Alert>{errorMessage(t, book.error)}</Alert>
        )}
        <Field label={t('points.direction')}>
          <div className="grid grid-cols-2 gap-3">
            <ChoiceTile
              name="direction"
              checked={direction === 'credit'}
              onChange={() => setDirection('credit')}
            >
              <PlusCircleIcon className="size-10" aria-hidden="true" />
              {t('points.credit')}
            </ChoiceTile>
            <ChoiceTile
              name="direction"
              checked={direction === 'deduct'}
              onChange={() => setDirection('deduct')}
            >
              <MinusCircleIcon className="size-10" aria-hidden="true" />
              {t('points.deduct')}
            </ChoiceTile>
          </div>
        </Field>
        <Field label={t('points.amount')}>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              aria-label={t('tasks.fewer_points')}
              disabled={amount <= 1}
              onClick={() => setAmountClamped(amount - 1)}
            >
              <MinusIcon className="size-7" aria-hidden="true" />
            </Button>
            <label className="flex min-h-14 items-center gap-2 rounded-2xl border-2 border-slate-200 px-4 focus-within:border-orange-400">
              <span className="sr-only">{t('points.amount')}</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={MANUAL_MAX_POINTS}
                value={amount}
                onChange={(event) => setAmountClamped(Math.trunc(Number(event.target.value)))}
                className="w-20 bg-transparent text-center text-2xl font-extrabold outline-none"
              />
            </label>
            <Button
              variant="secondary"
              aria-label={t('tasks.more_points')}
              disabled={amount >= MANUAL_MAX_POINTS}
              onClick={() => setAmountClamped(amount + 1)}
            >
              <PlusIcon className="size-7" aria-hidden="true" />
            </Button>
          </div>
        </Field>
        <TextField
          label={t('points.reason')}
          hint={t('points.reason_hint')}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={200}
          autoComplete="off"
          error={reasonError}
        />
        <Button type="submit" className="self-start" disabled={book.isPending}>
          {t(direction === 'credit' ? 'points.submit_credit' : 'points.submit_deduct', {
            count: amount,
          })}
        </Button>
      </form>

      <Section title={t('points.history')}>
        {history.isError && <Alert>{errorMessage(t, history.error)}</Alert>}
        {history.isPending && (
          <p role="status" className="text-lg text-slate-600">
            {t('common.loading')}
          </p>
        )}
        {history.isSuccess && transactions.length === 0 && (
          <p className="text-lg text-slate-600">{t('points.history_empty')}</p>
        )}
        {transactions.length > 0 && (
          <ul className="flex flex-col divide-y divide-slate-100">
            {transactions.map((transaction) => (
              <TransactionRow key={transaction.id} transaction={transaction} timeZone={timeZone} />
            ))}
          </ul>
        )}
        {history.hasNextPage && (
          <Button
            variant="secondary"
            className="self-start"
            disabled={history.isFetchingNextPage}
            onClick={() => void history.fetchNextPage()}
          >
            {t('points.load_more')}
          </Button>
        )}
      </Section>
    </main>
  )
}

function TransactionRow({
  transaction,
  timeZone,
}: {
  transaction: PointTransaction
  timeZone: string
}) {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language
  const KindIcon = KIND_ICONS[transaction.kind] ?? ManualIcon
  const when = new Intl.DateTimeFormat(language, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(transaction.created_at))
  const positive = transaction.amount > 0

  return (
    <li className="flex items-center gap-3 py-3">
      <span className="shrink-0">
        {transaction.task_icon ? (
          <TaskIcon icon={transaction.task_icon} className="size-12" />
        ) : (
          <KindIcon className="size-12" aria-hidden="true" />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-lg font-bold break-words text-slate-800">{transaction.reason}</span>
        <span className="flex flex-wrap items-center gap-x-2 text-base text-slate-500">
          {transaction.task_icon && <KindIcon className="size-5" aria-hidden="true" />}
          {t(`points.kind_${transaction.kind}`)} · {when}
        </span>
      </span>
      <span
        className={`shrink-0 rounded-full px-3 py-1 text-xl font-extrabold tabular-nums ${positive ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}
      >
        {positive ? `+${transaction.amount}` : `−${Math.abs(transaction.amount)}`}
      </span>
    </li>
  )
}
