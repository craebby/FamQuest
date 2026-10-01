import { useTranslation } from 'react-i18next'
import CloseIcon from '~icons/lucide/x'

import { useMembers } from '../../api/members'
import { Avatar } from '../../components/Avatar'
import type { ChoreDone } from './useChoreDone'

/** Nach dem Erledigen: freiwillig antippen, wer es war, oder den Tipp zurücknehmen. */
export function WhoBar({ done }: { done: ChoreDone }) {
  const { t } = useTranslation()
  const members = useMembers().data ?? []
  const asking = done.asking
  if (!asking) return null
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
        {t('chores.done_notice', { title: asking.title })}{' '}
        {sorted.length > 0 && <span className="font-normal">{t('chores.who')}</span>}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {sorted.map((member) => (
          <button
            key={member.id}
            type="button"
            aria-label={member.name}
            title={member.name}
            onClick={() => asking.pick(member.id)}
            className="rounded-full focus-visible:outline-4 focus-visible:outline-orange-400"
          >
            <Avatar name={member.name} color={member.color} src={member.avatar_url} size="sm" />
          </button>
        ))}
        <button
          type="button"
          onClick={asking.undo}
          className="min-h-12 rounded-2xl px-4 text-lg font-bold underline focus-visible:outline-4 focus-visible:outline-orange-400"
        >
          {t('chores.undo')}
        </button>
        <button
          type="button"
          aria-label={t('chores.who_close')}
          onClick={done.close}
          className="flex size-12 items-center justify-center rounded-2xl hover:bg-slate-700 focus-visible:outline-4 focus-visible:outline-orange-400"
        >
          <CloseIcon className="size-7" aria-hidden="true" />
        </button>
      </div>
    </section>
  )
}
