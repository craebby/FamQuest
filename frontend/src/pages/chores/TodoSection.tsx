import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import CheckIcon from '~icons/fluent-emoji-flat/check-mark-button'
import SaveIcon from '~icons/lucide/check'
import PencilIcon from '~icons/lucide/pencil'
import PlusIcon from '~icons/lucide/plus'
import RepeatIcon from '~icons/lucide/repeat'
import CloseIcon from '~icons/lucide/x'

import { type Todo, useAddTodo, useRemoveTodo, useUpdateTodo } from '../../api/chores'
import type { Member } from '../../api/members'
import { Avatar } from '../../components/Avatar'
import { TaskIcon } from '../../components/TaskIcon'
import { Alert, Button } from '../../components/ui'
import { errorMessage } from '../../errors'
import { iconId, suggestIcon } from '../../icons/catalog'
import { IconPicker } from '../parents/IconPicker'
import { areaPath } from '../parents/areas'
import type { ChoreDone } from './useChoreDone'

/** Symbol, solange der Text kein passenderes nahelegt. */
const DEFAULT_TODO_ICON = iconId('memo')

/** Adresse im Elternbereich, die aus einem Eintrag eine Aufgabe im Putzplan macht. */
const repeatPath = (todo: Todo) => `${areaPath('household')}?todo=${todo.id}`

/**
 * „Zu erledigen“: Einmaliges für den Haushalt ohne Person und Termin. Eintippen, ein Tipp hakt
 * ab, ein weiterer nimmt es zurück; Abgehaktes bleibt bis zum Ende des Tages stehen. Der Stift
 * ändert Text und Symbol eines offenen Eintrags. Ohne Eltern-PIN. „Kommt wieder“ führt in den Elternbereich und macht daraus eine Aufgabe im Putzplan.
 */
export function TodoSection({
  todos,
  members,
  done,
}: {
  todos: Todo[]
  members: Member[]
  done: ChoreDone
}) {
  const { t } = useTranslation()
  const add = useAddTodo()
  const remove = useRemoveTodo()
  const [title, setTitle] = useState('')
  // Selbst gewähltes Symbol; sonst folgt es dem Text.
  const [chosenIcon, setChosenIcon] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)

  const typed = title.trim()
  const icon = chosenIcon ?? suggestIcon(typed) ?? DEFAULT_TODO_ICON
  const error = add.error ?? remove.error

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!typed) return
    add.mutate({ title: typed, icon })
    setTitle('')
    setChosenIcon(null)
  }

  return (
    <section aria-labelledby="todos-title" className="flex flex-col gap-3">
      <h2 id="todos-title" className="text-2xl font-extrabold text-slate-800">
        {t('todos.title')}
      </h2>

      <form onSubmit={submit} className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setPicking(true)}
          aria-label={t('tasks.change_icon')}
          title={t('tasks.change_icon')}
          className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-white ring-2 ring-orange-200 hover:bg-orange-50 focus-visible:outline-4 focus-visible:outline-orange-400"
        >
          <TaskIcon icon={icon} className="size-12" />
        </button>
        <label className="flex min-h-16 min-w-0 flex-1 basis-56 items-center rounded-2xl border-2 border-slate-200 bg-white px-4 focus-within:border-orange-400">
          <span className="sr-only">{t('todos.new')}</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t('todos.placeholder')}
            maxLength={100}
            className="min-w-0 flex-1 bg-transparent text-xl outline-none"
            autoComplete="off"
            enterKeyHint="done"
          />
        </label>
        <Button type="submit" disabled={!typed}>
          <PlusIcon className="size-7" aria-hidden="true" />
          {t('todos.add')}
        </Button>
      </form>

      {error ? <Alert>{errorMessage(t, error)}</Alert> : null}

      {todos.length === 0 ? (
        <p className="text-lg text-slate-500">{t('todos.empty')}</p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(28rem,100%),1fr))] gap-3">
          {todos.map((todo) => (
            <TodoRow
              key={todo.id}
              todo={todo}
              doneBy={members.find((member) => member.id === todo.done_by)}
              onToggle={() => done.toggleTodo(todo)}
              onRemove={() => remove.mutate(todo.id)}
            />
          ))}
        </ul>
      )}

      {picking && (
        <IconPicker
          value={icon}
          initialCategory="household"
          onSelect={(selected) => {
            setChosenIcon(selected)
            setPicking(false)
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </section>
  )
}

const SIDE_BUTTON =
  'flex w-14 shrink-0 items-center justify-center rounded-2xl text-slate-400 focus-visible:outline-4 focus-visible:outline-orange-400'

/** Ein Eintrag als große Zeile; der Kreis links zeigt, ob er schon erledigt ist. */
function TodoRow({
  todo,
  doneBy,
  onToggle,
  onRemove,
}: {
  todo: Todo
  doneBy?: Member
  onToggle: () => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  if (editing && !todo.done) return <TodoEditRow todo={todo} onClose={() => setEditing(false)} />
  return (
    <li
      className={`flex min-w-0 items-stretch gap-1 rounded-2xl bg-white p-1 shadow-sm ${todo.done ? 'opacity-60' : ''}`}
    >
      <button
        type="button"
        aria-pressed={todo.done}
        onClick={onToggle}
        className="flex min-h-20 min-w-0 flex-1 items-center gap-3 rounded-xl p-2 text-left hover:bg-orange-50 focus-visible:outline-4 focus-visible:outline-orange-400 active:bg-orange-100"
      >
        {todo.done ? (
          <CheckIcon className="size-10 shrink-0" aria-hidden="true" />
        ) : (
          <span
            aria-hidden="true"
            className="size-10 shrink-0 rounded-full bg-white ring-4 ring-slate-300"
          />
        )}
        <TaskIcon icon={todo.icon} className="size-14" />
        <span
          className={`min-w-0 flex-1 text-xl leading-tight font-bold break-words hyphens-auto text-slate-800 ${todo.done ? 'line-through' : ''}`}
        >
          {todo.title}
        </span>
        {todo.done && doneBy && (
          <Avatar
            name={doneBy.name}
            color={doneBy.color}
            src={doneBy.avatar_url}
            size="sm"
            label={t('chores.done_by', { name: doneBy.name })}
          />
        )}
      </button>
      <Link
        to={repeatPath(todo)}
        aria-label={t('todos.repeat', { title: todo.title })}
        title={t('todos.repeat', { title: todo.title })}
        className={`${SIDE_BUTTON} hover:bg-orange-50 hover:text-orange-700`}
      >
        <RepeatIcon className="size-7" aria-hidden="true" />
      </Link>
      {!todo.done && (
        <button
          type="button"
          aria-label={t('todos.edit', { title: todo.title })}
          title={t('todos.edit', { title: todo.title })}
          onClick={() => setEditing(true)}
          className={`${SIDE_BUTTON} hover:bg-orange-50 hover:text-orange-700`}
        >
          <PencilIcon className="size-7" aria-hidden="true" />
        </button>
      )}
      {!todo.done && (
        <button
          type="button"
          aria-label={t('todos.remove', { title: todo.title })}
          title={t('todos.remove', { title: todo.title })}
          onClick={onRemove}
          className={`${SIDE_BUTTON} hover:bg-red-50 hover:text-red-700`}
        >
          <CloseIcon className="size-7" aria-hidden="true" />
        </button>
      )}
    </li>
  )
}

/** Derselbe Eintrag zum Ändern: Symbol und Text, speichern oder abbrechen. */
function TodoEditRow({ todo, onClose }: { todo: Todo; onClose: () => void }) {
  const { t } = useTranslation()
  const update = useUpdateTodo()
  const [title, setTitle] = useState(todo.title)
  const [icon, setIcon] = useState(todo.icon)
  const [picking, setPicking] = useState(false)
  const typed = title.trim()

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!typed) return
    if (typed === todo.title && icon === todo.icon) return onClose()
    update.mutate({ id: todo.id, title: typed, icon }, { onSuccess: onClose })
  }

  return (
    <li className="flex min-w-0 flex-col gap-2 rounded-2xl bg-white p-2 shadow-sm ring-2 ring-orange-300">
      <form
        onSubmit={submit}
        aria-label={t('todos.edit_title')}
        className="flex min-w-0 items-stretch gap-1"
      >
        <button
          type="button"
          onClick={() => setPicking(true)}
          aria-label={t('tasks.change_icon')}
          title={t('tasks.change_icon')}
          className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-orange-50 hover:bg-orange-100 focus-visible:outline-4 focus-visible:outline-orange-400"
        >
          <TaskIcon icon={icon} className="size-12" />
        </button>
        <label className="flex min-h-16 min-w-0 flex-1 items-center rounded-xl border-2 border-slate-200 px-3 focus-within:border-orange-400">
          <span className="sr-only">{t('todos.edit_title')}</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={100}
            className="min-w-0 flex-1 bg-transparent text-xl outline-none"
            autoComplete="off"
            enterKeyHint="done"
            autoFocus
          />
        </label>
        <button
          type="submit"
          disabled={!typed || update.isPending}
          aria-label={t('actions.save')}
          title={t('actions.save')}
          className="flex w-14 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-white hover:bg-orange-600 focus-visible:outline-4 focus-visible:outline-orange-400 disabled:opacity-40"
        >
          <SaveIcon className="size-7" strokeWidth={3} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={t('actions.cancel')}
          title={t('actions.cancel')}
          onClick={onClose}
          className={`${SIDE_BUTTON} hover:bg-slate-100 hover:text-slate-700`}
        >
          <CloseIcon className="size-7" aria-hidden="true" />
        </button>
      </form>
      {update.error ? <Alert>{errorMessage(t, update.error)}</Alert> : null}
      {picking && (
        <IconPicker
          value={icon}
          initialCategory="household"
          onSelect={(selected) => {
            setIcon(selected)
            setPicking(false)
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </li>
  )
}
