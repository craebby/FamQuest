import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import CheckIcon from '~icons/fluent-emoji-flat/check-mark-button'
import ConfettiIcon from '~icons/fluent-emoji-flat/confetti-ball'
import CrossIcon from '~icons/fluent-emoji-flat/cross-mark'
import GiftIcon from '~icons/fluent-emoji-flat/wrapped-gift'
import StarIcon from '~icons/fluent-emoji-flat/glowing-star'
import PartyIcon from '~icons/fluent-emoji-flat/party-popper'
import PawIcon from '~icons/fluent-emoji-flat/paw-prints'
import PencilIcon from '~icons/fluent-emoji-flat/pencil'
import PoopIcon from '~icons/fluent-emoji-flat/pile-of-poo'
import TrophyIcon from '~icons/fluent-emoji-flat/trophy'

import {
  type Companion,
  type CompanionItem,
  type Species,
  STAGE_STARTS,
  TRICK_STARTS,
  useBuyItem,
  useChooseCompanion,
  useWearItem,
} from '../../api/companions'
import type { Member } from '../../api/members'
import { Alert, Button, TextField } from '../../components/ui'
import { errorMessage } from '../../errors'
import { colorTokens } from '../../memberColors'
import { CompanionFigure, Particles } from './art'
import {
  FOOD_ICONS,
  HeartIcon,
  ITEM_ICONS,
  type Icon,
  SPECIES_ICONS,
  SPECIES_STYLE,
  SparklesIcon,
  TRICKS,
} from './icons'
import { moodFor } from './mood'
import { useDailyCounter } from './useDailyCounter'

/** Alle so vielen Portionen macht das Tier ein Häufchen (zum Wegtippen). */
const FOOD_PER_POOP = 3
/** Das große Tier zeigt von selbst ab und zu ein Kunststück. */
const SHOW_OFF_MS = 30 * 1000

interface Action {
  motion?: string
  particles: Icon[]
  key: number
}

interface HabitatProps {
  member: Member
  companion: Companion & { species: Species }
  items: CompanionItem[]
  date: string
  /** Heute selbst erledigte Aufgaben = Portionen Futter. */
  food: number
  /** Alles, was heute zählt, ist erledigt. */
  allDone: boolean
  /** Es ist noch etwas offen: das Tier zeigt, dass es Hunger hat. */
  open: boolean
  balance: number
  /** Testmodus: eigene Zähler, damit die echten Portionen und Häufchen unberührt bleiben. */
  test?: boolean
}

export function Habitat({
  member,
  companion,
  items,
  date,
  food,
  allDone,
  open,
  balance,
  test = false,
}: HabitatProps) {
  const { t } = useTranslation()
  const tokens = colorTokens(member.color)
  const species = companion.species
  const suffix = test ? '.test' : ''
  const [seenFood, setSeenFood] = useDailyCounter(
    `famquest.companion.fed.${member.id}${suffix}`,
    date,
  )
  const [cleaned, setCleaned] = useDailyCounter(
    `famquest.companion.clean.${member.id}${suffix}`,
    date,
  )
  const isEgg = companion.stage === 'egg'
  const [action, setAction] = useState<Action | null>(null)
  const counter = useRef(0)
  const [buying, setBuying] = useState<CompanionItem | null>(null)

  const play = (motion: string | undefined, particles: Icon[]) => {
    counter.current += 1
    setAction({ motion, particles, key: counter.current })
  }

  // Neue Portionen seit dem letzten Blick: fressen und freuen.
  useEffect(() => {
    if (food > seenFood) {
      setSeenFood(food)
      // Das Ei frisst noch nicht: es wackelt kräftig, leuchtet und Herzen steigen auf.
      if (isEgg) play('animate-egg-shake', [HeartIcon, SparklesIcon])
      else play('animate-pet-munch', [HeartIcon, FOOD_ICONS[species]])
    } else if (food < seenFood) setSeenFood(food)
  }, [food, seenFood, setSeenFood, species, isEgg])

  // Das große Tier zeigt zwischendurch von selbst, was es kann.
  const tricks = companion.tricks
  useEffect(() => {
    if (tricks.length === 0) return
    const timer = window.setInterval(() => {
      const trick = TRICKS[tricks[Math.floor(Math.random() * tricks.length)]]
      play(trick.motion, trick.particles)
    }, SHOW_OFF_MS)
    return () => window.clearInterval(timer)
  }, [tricks])

  const mood = moodFor(food, open, allDone)
  const poops = Math.max(0, Math.floor(food / FOOD_PER_POOP) - cleaned)
  const Food = FOOD_ICONS[species]

  return (
    <div className="flex flex-col gap-6">
      <div
        className="relative overflow-hidden rounded-[2.5rem] border-4 bg-gradient-to-b from-sky-100 via-white to-lime-100 p-4 shadow-sm"
        style={{ borderColor: tokens.main }}
      >
        {allDone && <Confetti />}
        <div className="mx-auto w-full max-w-md">
          <button
            type="button"
            aria-label={t('companion.pet', {
              name: companion.name || t(`companion.species.${species}`),
            })}
            onClick={() =>
              isEgg ? play('animate-egg-shake', [HeartIcon]) : play('animate-pet-hop', [HeartIcon])
            }
            className="block w-full rounded-[2rem] focus-visible:outline-4 focus-visible:outline-orange-400"
          >
            <CompanionFigure
              species={species}
              stage={companion.stage}
              careDays={companion.care_days}
              equipped={companion.equipped}
              mood={mood}
              motion={action?.motion}
              actionKey={action?.key}
            />
          </button>
        </div>
        {action && <Particles icons={action.particles} burstKey={action.key} />}
        {open && !allDone && (
          // Denkblase: Lieblingsfutter (beim Ei ein Stern). Ein Tipp führt zu den Aufgaben.
          <Link
            to={`/member/${member.id}`}
            aria-label={t(isEgg ? 'companion.hungry_egg' : 'companion.hungry', {
              name: companion.name || t(`companion.species.${species}`),
            })}
            className="absolute top-[6%] right-[6%] flex animate-bubble-float flex-col items-end focus-visible:outline-4 focus-visible:outline-orange-400"
          >
            <span className="flex size-24 items-center justify-center rounded-full border-4 border-slate-200 bg-white shadow-md sm:size-28">
              {isEgg ? (
                <StarIcon className="size-14 sm:size-16" aria-hidden="true" />
              ) : (
                <Food className="size-14 sm:size-16" aria-hidden="true" />
              )}
            </span>
            <span className="mr-10 -mt-1 size-5 rounded-full border-4 border-slate-200 bg-white" />
            <span className="mr-14 size-3 rounded-full border-2 border-slate-200 bg-white" />
          </Link>
        )}
        {/* Häufchen zum Wegtippen, ohne Ärger: es glitzert und das Tier freut sich. */}
        {Array.from({ length: poops }, (_, index) => (
          <button
            key={index}
            type="button"
            aria-label={t('companion.clean_up')}
            onClick={() => {
              setCleaned(cleaned + 1)
              play('animate-pet-hop', [SparklesIcon])
            }}
            className="absolute rounded-full p-1 focus-visible:outline-4 focus-visible:outline-orange-400"
            style={{ bottom: `${8 + index * 4}%`, left: `${8 + index * 12}%` }}
          >
            <PoopIcon className="size-14" aria-hidden="true" />
          </button>
        ))}
        <CompanionName member={member} companion={companion} />
        <FoodBowl food={food} Food={Food} />
      </div>

      <Growth companion={companion} />

      {companion.tricks.length > 0 && (
        <section aria-label={t('companion.tricks')} className="flex flex-wrap justify-center gap-3">
          {companion.tricks.map((trick) => {
            const art = TRICKS[trick]
            return (
              <button
                key={trick}
                type="button"
                aria-label={t(`companion.trick.${trick}`)}
                onClick={() => play(art.motion, art.particles)}
                className="flex size-20 items-center justify-center rounded-3xl bg-white shadow-sm transition-transform hover:bg-orange-50 focus-visible:outline-4 focus-visible:outline-orange-400 active:scale-90 motion-reduce:active:scale-100"
              >
                <art.icon className="size-12" aria-hidden="true" />
              </button>
            )
          })}
        </section>
      )}

      <Shop
        companion={companion}
        items={items}
        balance={balance}
        member={member}
        onBuy={setBuying}
        onWear={() => play('animate-pet-hop', [SparklesIcon])}
      />
      {buying && (
        <BuyDialog
          member={member}
          item={buying}
          onClose={(bought) => {
            setBuying(null)
            if (bought) play('animate-pet-jump', [SparklesIcon, HeartIcon])
          }}
        />
      )}
    </div>
  )
}

function Confetti() {
  const colors = ['bg-pink-400', 'bg-amber-400', 'bg-sky-400', 'bg-lime-400', 'bg-violet-400']
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 24 }, (_, index) => (
        <span
          key={index}
          className={`absolute top-0 h-4 w-2 animate-confetti rounded-sm ${colors[index % colors.length]}`}
          style={{
            left: `${(index * 37) % 100}%`,
            animationDelay: `${(index % 8) * 180}ms`,
            animationIterationCount: 3,
          }}
        />
      ))}
      <PartyIcon className="absolute top-3 left-3 size-14 animate-pop" />
      <ConfettiIcon className="absolute top-3 right-3 size-14 animate-pop" />
    </div>
  )
}

function FoodBowl({ food, Food }: { food: number; Food: Icon }) {
  const { t } = useTranslation()
  const shown = Math.min(food, 10)
  return (
    <div
      role="img"
      aria-label={t('companion.food', { count: food })}
      className="mt-2 flex min-h-14 flex-wrap items-center justify-center gap-1"
    >
      {food === 0 ? (
        <Food className="size-12 opacity-25 grayscale" aria-hidden="true" />
      ) : (
        Array.from({ length: shown }, (_, index) => (
          <Food key={index} className="size-12 animate-pop" aria-hidden="true" />
        ))
      )}
      {food > shown && (
        <span aria-hidden="true" className="text-2xl font-extrabold text-slate-600">
          +{food - shown}
        </span>
      )}
    </div>
  )
}

function CompanionName({
  member,
  companion,
}: {
  member: Member
  companion: Companion & { species: Species }
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(companion.name)
  const save = useChooseCompanion(member.id)
  const shown = companion.name || t(`companion.species.${companion.species}`)

  if (editing) {
    return (
      <form
        className="mx-auto mt-2 flex w-full max-w-md flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          save.mutate(
            { species: companion.species, name: name.trim() },
            { onSuccess: () => setEditing(false) },
          )
        }}
      >
        <TextField
          label={t('companion.name')}
          value={name}
          maxLength={24}
          onChange={(event) => setName(event.target.value)}
        />
        {save.isError && <Alert>{errorMessage(t, save.error)}</Alert>}
        <div className="flex gap-2">
          <Button type="submit" disabled={save.isPending}>
            {t('actions.save')}
          </Button>
          <Button variant="secondary" onClick={() => setEditing(false)}>
            {t('actions.cancel')}
          </Button>
        </div>
      </form>
    )
  }
  return (
    <div className="mt-1 flex items-center justify-center gap-2">
      <h2 className="text-3xl font-extrabold break-words text-slate-800">{shown}</h2>
      <button
        type="button"
        aria-label={t('companion.rename')}
        onClick={() => {
          setName(companion.name)
          setEditing(true)
        }}
        className="rounded-full p-2 hover:bg-white focus-visible:outline-4 focus-visible:outline-orange-400"
      >
        <PencilIcon className="size-7" aria-hidden="true" />
      </button>
    </div>
  )
}

/** Pfoten bis zur nächsten Stufe bzw. zum nächsten Kunststück, am Ende was als Nächstes kommt. */
function Growth({ companion }: { companion: Companion & { species: Species } }) {
  const { t } = useTranslation()
  const days = companion.care_days
  const Animal = SPECIES_ICONS[companion.species]
  // Nächstes Ereignis: neue Stufe oder neues Kunststück, je nachdem, was zuerst kommt.
  const lastTrick = companion.tricks.at(-1)
  const start = Math.max(STAGE_STARTS[companion.stage], lastTrick ? TRICK_STARTS[lastTrick] : 0)
  const stageAt = companion.next_stage_at
  const trickAt = companion.next_trick_at
  const trickFirst = trickAt !== null && (stageAt === null || trickAt < stageAt)
  const target = trickFirst ? trickAt : stageAt
  if (target === null) return null
  const total = target - start
  const filled = Math.min(total, days - start)
  const next = trickFirst
    ? 'trick'
    : companion.stage === 'egg'
      ? 'baby'
      : companion.stage === 'baby'
        ? 'kid'
        : companion.stage === 'kid'
          ? 'grown'
          : 'trick'

  return (
    <div
      role="img"
      aria-label={t(`companion.growth_${next}`, { count: target - days })}
      className="flex flex-wrap items-center justify-center gap-1 rounded-3xl bg-white p-3 shadow-sm"
    >
      {Array.from({ length: total }, (_, index) => (
        <PawIcon
          key={index}
          aria-hidden="true"
          className={`size-9 ${index < filled ? '' : 'opacity-20 grayscale'}`}
        />
      ))}
      <span aria-hidden="true" className="ml-2 flex items-center">
        {next === 'trick' ? (
          <GiftIcon className="size-12 animate-pet-wiggle" />
        ) : (
          <Animal
            className={next === 'baby' ? 'size-9' : next === 'kid' ? 'size-11' : 'size-14'}
            style={SPECIES_STYLE[companion.species]}
          />
        )}
      </span>
    </div>
  )
}

function Shop({
  member,
  companion,
  items,
  balance,
  onBuy,
  onWear,
}: {
  member: Member
  companion: Companion
  items: CompanionItem[]
  balance: number
  onBuy: (item: CompanionItem) => void
  onWear: () => void
}) {
  const { t } = useTranslation()
  const wear = useWearItem(member.id)
  const sorted = [...items].sort((a, b) => a.cost - b.cost)
  return (
    <section aria-label={t('companion.shop')} className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-2xl font-extrabold text-slate-800">
        <GiftIcon className="size-9" aria-hidden="true" />
        {t('companion.shop')}
      </h2>
      {wear.isError && <Alert>{errorMessage(t, wear.error)}</Alert>}
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-3">
        {sorted.map((item) => {
          const Item = ITEM_ICONS[item.key]
          const owned = companion.owned.includes(item.key)
          const worn = companion.equipped[item.slot] === item.key
          const affordable = balance >= item.cost
          const label = t(`companion.items.${item.key}`)
          return (
            <li key={item.key}>
              <button
                type="button"
                aria-label={
                  owned
                    ? t(worn ? 'companion.take_off' : 'companion.put_on', { item: label })
                    : t('companion.buy_item', { item: label, count: item.cost })
                }
                aria-pressed={owned ? worn : undefined}
                disabled={!owned && !affordable}
                onClick={() => {
                  if (owned) {
                    wear.mutate({ item: item.key, worn: !worn })
                    onWear()
                  } else onBuy(item)
                }}
                className={`flex w-full flex-col items-center gap-1 rounded-3xl border-4 bg-white p-3 shadow-sm transition-transform focus-visible:outline-4 focus-visible:outline-orange-400 active:scale-95 disabled:opacity-40 motion-reduce:active:scale-100 ${worn ? 'border-lime-400' : 'border-transparent'}`}
              >
                {Item && <Item className="size-14" aria-hidden="true" />}
                {owned ? (
                  worn ? (
                    <CheckIcon className="size-7" aria-hidden="true" />
                  ) : (
                    <span className="h-7" />
                  )
                ) : (
                  <span className="flex items-center gap-1 text-xl font-extrabold text-slate-700">
                    <TrophyIcon className="size-6" aria-hidden="true" />
                    <span aria-hidden="true">{item.cost}</span>
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function BuyDialog({
  member,
  item,
  onClose,
}: {
  member: Member
  item: CompanionItem
  onClose: (bought: boolean) => void
}) {
  const { t } = useTranslation()
  const buy = useBuyItem(member.id)
  const Item = ITEM_ICONS[item.key]
  const dialog = useRef<HTMLDivElement>(null)
  useEffect(() => dialog.current?.focus(), [])
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('companion.buy_item', {
        item: t(`companion.items.${item.key}`),
        count: item.cost,
      })}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4"
    >
      <div
        ref={dialog}
        tabIndex={-1}
        className="flex w-full max-w-sm flex-col items-center gap-4 rounded-[2rem] bg-white p-6 outline-none"
      >
        {Item && <Item className="size-32 animate-pop" aria-hidden="true" />}
        <span className="flex items-center gap-2 text-4xl font-extrabold text-slate-800">
          <TrophyIcon className="size-10" aria-hidden="true" />
          {item.cost}
        </span>
        {buy.isError && <Alert>{errorMessage(t, buy.error)}</Alert>}
        <div className="flex gap-4">
          <button
            type="button"
            aria-label={t('companion.buy_confirm')}
            disabled={buy.isPending}
            onClick={() => buy.mutate(item.key, { onSuccess: () => onClose(true) })}
            className="flex size-24 items-center justify-center rounded-3xl bg-lime-100 focus-visible:outline-4 focus-visible:outline-orange-400 active:scale-95 disabled:opacity-50"
          >
            <CheckIcon className="size-16" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={t('actions.cancel')}
            onClick={() => onClose(false)}
            className="flex size-24 items-center justify-center rounded-3xl bg-red-50 focus-visible:outline-4 focus-visible:outline-orange-400 active:scale-95"
          >
            <CrossIcon className="size-16" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}
