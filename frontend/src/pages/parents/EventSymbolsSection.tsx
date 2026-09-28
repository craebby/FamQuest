import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import TrashIcon from '~icons/fluent-emoji-flat/wastebasket'
import CheckIcon from '~icons/lucide/check'
import PencilIcon from '~icons/lucide/pencil'
import PlusIcon from '~icons/lucide/plus'

import { type EventSymbol, useEventSymbols, useSetEventSymbols } from '../../api/calendar'
import { useMembers } from '../../api/members'
import { Avatar } from '../../components/Avatar'
import { TaskIcon } from '../../components/TaskIcon'
import { Alert, Button, Section, TextField } from '../../components/ui'
import { errorMessage } from '../../errors'
import { iconId, normalize } from '../../icons/catalog'
import {
  EVENT_SYMBOL_POOL,
  eventSymbolTemplateIcon,
  eventSymbolTemplateTerms,
  splitTerms,
} from '../../pools/eventSymbols'
import { IconPicker } from './IconPicker'

/** Neuer eigener Eintrag, bis ein Symbol gewählt ist. */
const NEW_SYMBOL_ICON = iconId('star')

/** Welcher Eintrag gerade bearbeitet wird: eine Stelle der Liste oder ein neuer. */
type Editing = { index: number } | { index: 'new' } | null

/**
 * Begriffe im Titel eines Termins bekommen ein Symbol (z. B. „Judo“ → Judoanzug), damit Kinder
 * ihre Termine ohne Lesen erkennen. Gilt für Personen, bei denen es eingeschaltet ist.
 */
export function EventSymbolsSection() {
  const { t } = useTranslation()
  const query = useEventSymbols()
  const save = useSetEventSymbols()
  const members = useMembers().data ?? []
  const [editing, setEditing] = useState<Editing>(null)
  const [suggesting, setSuggesting] = useState(false)

  const symbols = query.data?.symbols ?? []
  const withSymbols = members.filter((member) => member.event_symbols)
  const store = (next: EventSymbol[], onSuccess?: () => void) => save.mutate(next, { onSuccess })

  return (
    <Section title={t('event_symbols.section')}>
      {query.isError && <Alert>{errorMessage(t, query.error)}</Alert>}
      {save.isError && <Alert>{errorMessage(t, save.error)}</Alert>}
      <p className="text-lg text-slate-600">{t('event_symbols.intro')}</p>
      <div className="flex flex-wrap items-center gap-2 text-base text-slate-600">
        {withSymbols.length > 0 ? (
          <>
            <span className="font-bold">{t('event_symbols.for_members')}</span>
            {withSymbols.map((member) => (
              <span
                key={member.id}
                className="flex items-center gap-2 rounded-full bg-slate-50 py-1 pr-3 pl-1 font-bold text-slate-700"
              >
                <Avatar name={member.name} color={member.color} src={member.avatar_url} size="xs" />
                {member.name}
              </span>
            ))}
          </>
        ) : (
          <span>{t('event_symbols.for_nobody')}</span>
        )}
      </div>

      {query.data && symbols.length === 0 && !suggesting && editing?.index !== 'new' && (
        <p className="text-lg text-slate-500">{t('event_symbols.empty')}</p>
      )}
      {symbols.length > 0 && (
        <ul className="flex flex-col gap-3">
          {symbols.map((symbol, index) =>
            editing?.index === index ? (
              <li key={index}>
                <SymbolForm
                  initial={symbol}
                  busy={save.isPending}
                  onSave={(changed) =>
                    store(
                      symbols.map((entry, i) => (i === index ? changed : entry)),
                      () => setEditing(null),
                    )
                  }
                  onDelete={() =>
                    store(
                      symbols.filter((_, i) => i !== index),
                      () => setEditing(null),
                    )
                  }
                  onCancel={() => setEditing(null)}
                />
              </li>
            ) : (
              <li
                key={index}
                className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3"
                data-testid="event-symbol"
              >
                <TaskIcon icon={symbol.icon} className="size-12" />
                <p className="min-w-0 flex-1 text-lg break-words text-slate-700">
                  <span className="font-bold text-slate-800">{symbol.terms[0]}</span>
                  {symbol.terms.length > 1 && `, ${symbol.terms.slice(1).join(', ')}`}
                </p>
                <Button
                  variant="secondary"
                  disabled={editing !== null || suggesting}
                  onClick={() => setEditing({ index })}
                  aria-label={t('event_symbols.edit', { name: symbol.terms[0] })}
                  title={t('event_symbols.edit', { name: symbol.terms[0] })}
                >
                  <PencilIcon className="size-6" aria-hidden="true" />
                </Button>
              </li>
            ),
          )}
        </ul>
      )}

      {editing?.index === 'new' && (
        <SymbolForm
          initial={{ icon: NEW_SYMBOL_ICON, terms: [] }}
          busy={save.isPending}
          onSave={(created) => store([...symbols, created], () => setEditing(null))}
          onCancel={() => setEditing(null)}
        />
      )}

      {suggesting && (
        <SuggestionPicker
          existing={symbols}
          busy={save.isPending}
          onAdd={(added) => store([...symbols, ...added], () => setSuggesting(false))}
          onCancel={() => setSuggesting(false)}
        />
      )}

      {editing === null && !suggesting && query.data && (
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setSuggesting(true)}>
            <CheckIcon className="size-6" aria-hidden="true" />
            {t('event_symbols.choose_suggestions')}
          </Button>
          <Button variant="secondary" onClick={() => setEditing({ index: 'new' })}>
            <PlusIcon className="size-6" aria-hidden="true" />
            {t('event_symbols.add_own')}
          </Button>
        </div>
      )}
    </Section>
  )
}

function SymbolForm({
  initial,
  busy,
  onSave,
  onDelete,
  onCancel,
}: {
  initial: EventSymbol
  busy: boolean
  onSave: (symbol: EventSymbol) => void
  /** Nur bei vorhandenen Einträgen. */
  onDelete?: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const [icon, setIcon] = useState(initial.icon)
  const [text, setText] = useState(initial.terms.join(', '))
  const [picking, setPicking] = useState(false)
  const [missing, setMissing] = useState(false)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const terms = splitTerms(text)
    setMissing(terms.length === 0)
    if (terms.length > 0) onSave({ icon, terms })
  }

  return (
    <form
      className="flex flex-col gap-4 rounded-2xl bg-orange-50 p-4"
      onSubmit={submit}
      data-testid="event-symbol-form"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <Button variant="secondary" disabled={busy} onClick={() => setPicking(true)}>
          <TaskIcon icon={icon} className="size-10" />
          {t('event_symbols.change_icon')}
        </Button>
        <div className="min-w-0 flex-1">
          <TextField
            label={t('event_symbols.terms')}
            hint={t('event_symbols.terms_hint')}
            error={missing ? errorMessage(t, 'validation.required') : undefined}
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={500}
            autoComplete="off"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={busy}>
          {t('actions.save')}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={onCancel}>
          {t('actions.cancel')}
        </Button>
        {onDelete && (
          <Button variant="danger" className="sm:ml-auto" disabled={busy} onClick={onDelete}>
            <TrashIcon className="size-6" aria-hidden="true" />
            {t('event_symbols.delete')}
          </Button>
        )}
      </div>
      {picking && (
        <IconPicker
          value={icon}
          initialCategory="appointments"
          onSelect={(selected) => {
            setIcon(selected)
            setPicking(false)
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </form>
  )
}

/** Mehrere Vorschläge ankreuzen; schon vorhandene Begriffe sind abgehakt. */
function SuggestionPicker({
  existing,
  busy,
  onAdd,
  onCancel,
}: {
  existing: EventSymbol[]
  busy: boolean
  onAdd: (symbols: EventSymbol[]) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<string[]>([])
  const existingTerms = new Set(existing.flatMap((symbol) => symbol.terms.map(normalize)))
  const templates = EVENT_SYMBOL_POOL.map((template) => {
    const terms = eventSymbolTemplateTerms(t, template)
    return { ...template, terms, present: existingTerms.has(normalize(terms[0])) }
  })
  const toggle = (id: string) =>
    setSelected((ids) => (ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]))

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-orange-50 p-4">
      <p className="text-lg text-slate-600">{t('event_symbols.suggestions_intro')}</p>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3">
        {templates.map((template) => {
          const checked = template.present || selected.includes(template.id)
          return (
            <li key={template.id}>
              <label className={template.present ? 'cursor-not-allowed' : 'cursor-pointer'}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={template.present || busy}
                  onChange={() => toggle(template.id)}
                  className="peer sr-only"
                />
                <span className="relative flex h-full min-h-32 flex-col items-center gap-2 rounded-2xl border-2 border-slate-200 bg-white p-3 text-center peer-checked:border-orange-500 peer-checked:bg-orange-100 peer-focus-visible:outline-4 peer-focus-visible:outline-orange-400 peer-disabled:opacity-60">
                  {checked && (
                    <span className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-orange-500 text-white">
                      <CheckIcon className="size-4" strokeWidth={4} aria-hidden="true" />
                    </span>
                  )}
                  <TaskIcon icon={eventSymbolTemplateIcon(template)} className="size-12" />
                  <span className="text-lg leading-tight font-bold break-words hyphens-auto text-slate-800">
                    {template.terms[0]}
                  </span>
                  {template.present && (
                    <span className="text-sm font-bold text-slate-500">
                      {t('event_symbols.present')}
                    </span>
                  )}
                </span>
              </label>
            </li>
          )
        })}
      </ul>
      <div className="flex flex-wrap gap-3">
        <Button
          disabled={selected.length === 0 || busy}
          onClick={() =>
            onAdd(
              templates
                .filter((template) => selected.includes(template.id))
                .map((template) => ({
                  icon: eventSymbolTemplateIcon(template),
                  terms: template.terms,
                })),
            )
          }
        >
          {t('event_symbols.add_selected', { count: selected.length })}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={onCancel}>
          {t('actions.cancel')}
        </Button>
      </div>
    </div>
  )
}
