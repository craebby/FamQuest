import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import CheckIcon from '~icons/fluent-emoji-flat/check-mark-button'
import CrossIcon from '~icons/fluent-emoji-flat/cross-mark'
import EggIcon from '~icons/fluent-emoji-flat/egg'

import { type Species, useChooseCompanion } from '../../api/companions'
import type { Member } from '../../api/members'
import { Alert, TextField } from '../../components/ui'
import { errorMessage } from '../../errors'
import { SPECIES_ICONS, SPECIES_STYLE } from './icons'

/** Das Kind sucht sich sein Tier aus: große Bilder, ein Tipp, dann Haken. */
export function ChooseAnimal({ member, species }: { member: Member; species: Species[] }) {
  const { t } = useTranslation()
  const [picked, setPicked] = useState<Species | null>(null)
  const [name, setName] = useState('')
  const choose = useChooseCompanion(member.id)

  if (picked) {
    const Animal = SPECIES_ICONS[picked]
    return (
      <form
        className="mx-auto flex w-full max-w-md flex-col items-center gap-5 rounded-[2.5rem] bg-white p-6 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault()
          choose.mutate({ species: picked, name: name.trim() })
        }}
      >
        <div className="relative">
          <Animal
            className="size-48 animate-pet-bob"
            style={SPECIES_STYLE[picked]}
            aria-hidden="true"
          />
          <EggIcon className="absolute -right-6 bottom-0 size-16" aria-hidden="true" />
        </div>
        <p className="text-3xl font-extrabold text-slate-800">{t(`companion.species.${picked}`)}</p>
        <TextField
          label={t('companion.name_optional')}
          value={name}
          maxLength={24}
          onChange={(event) => setName(event.target.value)}
          hint={t('companion.name_hint')}
        />
        {choose.isError && <Alert>{errorMessage(t, choose.error)}</Alert>}
        <div className="flex gap-4">
          <button
            type="submit"
            aria-label={t('companion.choose_confirm')}
            disabled={choose.isPending}
            className="flex size-24 items-center justify-center rounded-3xl bg-lime-100 focus-visible:outline-4 focus-visible:outline-orange-400 active:scale-95 disabled:opacity-50"
          >
            <CheckIcon className="size-16" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={t('companion.choose_other')}
            onClick={() => setPicked(null)}
            className="flex size-24 items-center justify-center rounded-3xl bg-red-50 focus-visible:outline-4 focus-visible:outline-orange-400 active:scale-95"
          >
            <CrossIcon className="size-16" aria-hidden="true" />
          </button>
        </div>
      </form>
    )
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="flex items-center gap-3 text-3xl font-extrabold text-slate-800">
        <EggIcon className="size-12 animate-pet-wiggle" aria-hidden="true" />
        {t('companion.choose')}
      </h2>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-4">
        {species.map((key) => {
          const Animal = SPECIES_ICONS[key]
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => setPicked(key)}
                className="flex w-full flex-col items-center gap-2 rounded-3xl bg-white p-4 shadow-sm transition-transform hover:bg-orange-50 focus-visible:outline-4 focus-visible:outline-orange-400 active:scale-95 motion-reduce:active:scale-100"
              >
                <Animal className="size-24" style={SPECIES_STYLE[key]} aria-hidden="true" />
                <span className="text-lg font-bold text-slate-700">
                  {t(`companion.species.${key}`)}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
