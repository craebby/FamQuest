import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReorderIcon from '~icons/fluent-emoji-flat/left-right-arrow'
import ChevronLeftIcon from '~icons/lucide/chevron-left'
import ChevronRightIcon from '~icons/lucide/chevron-right'
import PlusIcon from '~icons/lucide/plus'

import { type Member, useReorderMembers } from '../../api/members'
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
  const reorder = useReorderMembers()
  const [sorting, setSorting] = useState(false)
  const [dragged, setDragged] = useState<number | null>(null)
  const full = members !== undefined && members.length >= MEMBER_COLORS.length

  return (
    <Section title={t('members.section')}>
      {error ? <Alert>{errorMessage(t, error)}</Alert> : null}
      {reorder.isError && <Alert>{errorMessage(t, reorder.error)}</Alert>}
      {members?.length === 0 && <p className="text-lg text-slate-600">{t('members.empty')}</p>}
      {sorting && <p className="text-base text-slate-500">{t('members.order_hint')}</p>}
      {members && members.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {members.map((member, index) =>
            sorting ? (
              <li
                key={member.id}
                // Mit der Maus lässt sich auch ziehen; am Touchscreen gibt es die Pfeile.
                draggable
                onDragStart={() => setDragged(index)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (dragged !== null) reorder.move(members, dragged, index)
                  setDragged(null)
                }}
                className="flex cursor-grab flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-orange-300 p-3 text-center"
              >
                <Avatar name={member.name} color={member.color} src={member.avatar_url} />
                <span className="w-full truncate text-lg font-bold text-slate-800">
                  {member.name}
                </span>
                <span className="flex gap-2">
                  <Button
                    variant="secondary"
                    className="px-3"
                    aria-label={t('members.move_left', { name: member.name })}
                    disabled={index === 0}
                    onClick={() => reorder.move(members, index, index - 1)}
                  >
                    <ChevronLeftIcon className="size-6" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="secondary"
                    className="px-3"
                    aria-label={t('members.move_right', { name: member.name })}
                    disabled={index === members.length - 1}
                    onClick={() => reorder.move(members, index, index + 1)}
                  >
                    <ChevronRightIcon className="size-6" aria-hidden="true" />
                  </Button>
                </span>
              </li>
            ) : (
              <li key={member.id}>
                <button
                  type="button"
                  onClick={() => onEdit(member)}
                  aria-label={t('members.edit_title', { name: member.name })}
                  className="flex w-full flex-col items-center gap-2 rounded-2xl p-3 text-center transition-colors hover:bg-orange-50 focus-visible:outline-4 focus-visible:outline-orange-400 active:bg-orange-100"
                >
                  <Avatar name={member.name} color={member.color} src={member.avatar_url} />
                  <span className="text-lg font-bold break-words text-slate-800">
                    {member.name}
                  </span>
                  <span className="text-base text-slate-500">{t(`roles.${member.role}`)}</span>
                </button>
              </li>
            ),
          )}
        </ul>
      )}
      <div className="flex flex-wrap gap-3">
        {sorting ? (
          <Button onClick={() => setSorting(false)}>{t('members.order_done')}</Button>
        ) : (
          <>
            {full ? (
              <p className="self-center text-base text-slate-500">
                {t('members.all_colors_taken')}
              </p>
            ) : (
              <Button onClick={onAdd} disabled={members === undefined}>
                <PlusIcon className="size-6" aria-hidden="true" />
                {t('members.add')}
              </Button>
            )}
            {members && members.length > 1 && (
              <Button variant="secondary" onClick={() => setSorting(true)}>
                <ReorderIcon className="size-6" aria-hidden="true" />
                {t('members.order')}
              </Button>
            )}
          </>
        )}
      </div>
    </Section>
  )
}
