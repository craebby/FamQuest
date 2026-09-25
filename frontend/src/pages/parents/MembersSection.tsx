import { useTranslation } from 'react-i18next'
import PlusIcon from '~icons/lucide/plus'

import type { Member } from '../../api/members'
import { Avatar } from '../../components/Avatar'
import { Alert, Button, Section } from '../../components/ui'
import { errorMessage } from '../../errors'
import { MEMBER_COLORS } from '../../memberColors'

interface MembersSectionProps {
  members: Member[] | undefined
  error: unknown
  onEdit: (member: Member) => void
  onAdd: () => void
}

/** Übersicht der Familienmitglieder im Elternbereich. */
export function MembersSection({ members, error, onEdit, onAdd }: MembersSectionProps) {
  const { t } = useTranslation()
  const full = members !== undefined && members.length >= MEMBER_COLORS.length

  return (
    <Section title={t('members.section')}>
      {error ? <Alert>{errorMessage(t, error)}</Alert> : null}
      {members?.length === 0 && <p className="text-lg text-slate-600">{t('members.empty')}</p>}
      {members && members.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {members.map((member) => (
            <li key={member.id}>
              <button
                type="button"
                onClick={() => onEdit(member)}
                aria-label={t('members.edit_title', { name: member.name })}
                className="flex w-full flex-col items-center gap-2 rounded-2xl p-3 text-center transition-colors hover:bg-orange-50 focus-visible:outline-4 focus-visible:outline-orange-400 active:bg-orange-100"
              >
                <Avatar name={member.name} color={member.color} src={member.avatar_url} />
                <span className="text-lg font-bold break-words text-slate-800">{member.name}</span>
                <span className="text-base text-slate-500">{t(`roles.${member.role}`)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {full ? (
        <p className="text-base text-slate-500">{t('members.all_colors_taken')}</p>
      ) : (
        <Button className="self-start" onClick={onAdd} disabled={members === undefined}>
          <PlusIcon className="size-6" aria-hidden="true" />
          {t('members.add')}
        </Button>
      )}
    </Section>
  )
}
