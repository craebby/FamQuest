import { useTranslation } from 'react-i18next'
import CheckIcon from '~icons/fluent-emoji-flat/check-mark-button'
import CrossIcon from '~icons/fluent-emoji-flat/cross-mark'
import StarIcon from '~icons/fluent-emoji-flat/star'

import {
  type Approval,
  approve,
  reject,
  useApprovalMutation,
  useApprovals,
} from '../../api/approvals'
import type { Member } from '../../api/members'
import { Avatar } from '../../components/Avatar'
import { TaskIcon } from '../../components/TaskIcon'
import { Alert, Button, Section } from '../../components/ui'
import { errorMessage } from '../../errors'
import { formatLongDate } from '../../weekdays'

interface ApprovalsSectionProps {
  members: Member[]
  /** Heutiges Datum der Familie; ältere Erledigungen zeigen ihr Datum. */
  today: string | undefined
}

/** Erledigungen, die auf die Kontrolle der Eltern warten. Ohne Einträge unsichtbar. */
export function ApprovalsSection({ members, today }: ApprovalsSectionProps) {
  const { t } = useTranslation()
  const approvals = useApprovals()
  const confirm = useApprovalMutation(approve)
  const decline = useApprovalMutation(reject)
  const confirmAll = useApprovalMutation(async (ids: number[]) => {
    for (const id of ids) await approve(id)
  })

  if (approvals.isError) {
    return (
      <Section title={t('approvals.section')}>
        <Alert>{errorMessage(t, approvals.error)}</Alert>
      </Section>
    )
  }
  if (!approvals.data || approvals.data.length === 0) return null

  const busy = confirm.isPending || decline.isPending || confirmAll.isPending
  const error = confirm.error ?? decline.error ?? confirmAll.error

  return (
    <Section title={t('approvals.section')}>
      <p className="text-lg text-slate-600">{t('approvals.intro')}</p>
      {error ? <Alert>{errorMessage(t, error)}</Alert> : null}
      <ul className="flex flex-col gap-3">
        {approvals.data.map((approval) => (
          <ApprovalRow
            key={approval.id}
            approval={approval}
            member={members.find((member) => member.id === approval.member_id)}
            today={today}
            busy={busy}
            onApprove={() => confirm.mutate(approval.id)}
            onReject={() => decline.mutate(approval.id)}
          />
        ))}
      </ul>
      {approvals.data.length > 1 && (
        <Button
          className="self-start"
          disabled={busy}
          onClick={() => confirmAll.mutate(approvals.data.map((approval) => approval.id))}
        >
          <CheckIcon className="size-7" aria-hidden="true" />
          {t('approvals.approve_all', { count: approvals.data.length })}
        </Button>
      )}
    </Section>
  )
}

function ApprovalRow({
  approval,
  member,
  today,
  busy,
  onApprove,
  onReject,
}: {
  approval: Approval
  member: Member | undefined
  today: string | undefined
  busy: boolean
  onApprove: () => void
  onReject: () => void
}) {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language
  const name = member?.name ?? '?'

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-slate-100 p-3">
      {member && (
        <Avatar name={member.name} color={member.color} src={member.avatar_url} size="sm" />
      )}
      <TaskIcon icon={approval.icon} className="size-12" />
      <span className="flex min-w-0 flex-1 basis-40 flex-col">
        <span className="text-lg font-bold break-words text-slate-800">{approval.title}</span>
        <span className="flex flex-wrap items-center gap-x-3 text-base text-slate-500">
          {name}
          {approval.date !== today && <span>{formatLongDate(language, approval.date)}</span>}
          <span className="inline-flex items-center gap-1 font-bold text-slate-700">
            <StarIcon className="size-5" aria-hidden="true" />
            <span aria-hidden="true">{approval.points}</span>
            <span className="sr-only">{t('tasks.points_count', { count: approval.points })}</span>
          </span>
        </span>
      </span>
      <span className="flex gap-2">
        <Button
          variant="secondary"
          disabled={busy}
          onClick={onReject}
          aria-label={t('approvals.reject_label', { title: approval.title, name })}
        >
          <CrossIcon className="size-7" aria-hidden="true" />
          {t('approvals.reject')}
        </Button>
        <Button
          disabled={busy}
          onClick={onApprove}
          aria-label={t('approvals.approve_label', { title: approval.title, name })}
        >
          <CheckIcon className="size-7" aria-hidden="true" />
          {t('approvals.approve')}
        </Button>
      </span>
    </li>
  )
}
