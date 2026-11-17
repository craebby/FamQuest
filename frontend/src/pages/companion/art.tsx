import type { CSSProperties } from 'react'
import EggIcon from '~icons/fluent-emoji-flat/egg'
import HeadphoneIcon from '~icons/fluent-emoji-flat/headphone'

import type { ItemSlot, Species, Stage } from '../../api/companions'
import type { Mood } from './mood'
import { type Icon, ITEM_ICONS, SPECIES_ICONS, SPECIES_STYLE } from './icons'

/** Größe des Tiers je Stufe (Anteil an der Bühne). */
const STAGE_SIZE: Record<Exclude<Stage, 'egg'>, string> = {
  baby: '42%',
  kid: '54%',
  teen: '64%',
  grown: '74%',
}

/**
 * Kopf je Tier in Prozent der Zeichnung: Mitte (x), Oberkante (top), Augenhöhe (eye) und Breite (w).
 * Viele Tiere sind von der Seite gezeichnet (Kopf links), deshalb sitzt Kopfschmuck nicht einfach
 * oben in der Mitte.
 */
const HEAD: Record<Species, { x: number; top: number; eye: number; w: number }> = {
  cat: { x: 20, top: 25, eye: 37, w: 30 },
  dog: { x: 21, top: 23, eye: 35, w: 30 },
  fox: { x: 50, top: 22, eye: 57, w: 62 },
  dragon: { x: 33, top: 18, eye: 26, w: 34 },
  unicorn: { x: 34, top: 22, eye: 42, w: 40 },
  horse: { x: 17, top: 12, eye: 20, w: 24 },
  snow_leopard: { x: 18, top: 28, eye: 43, w: 28 },
  giraffe: { x: 21, top: 11, eye: 20, w: 20 },
  turtle: { x: 14, top: 63, eye: 70, w: 16 },
  shark: { x: 33, top: 14, eye: 34, w: 34 },
  dolphin: { x: 38, top: 7, eye: 21, w: 32 },
  panda: { x: 50, top: 17, eye: 51, w: 72 },
  rabbit: { x: 24, top: 20, eye: 43, w: 34 },
  penguin: { x: 50, top: 8, eye: 24, w: 44 },
  koala: { x: 50, top: 16, eye: 54, w: 64 },
}

function slotStyle(species: Species, slot: 'head' | 'face' | 'toy' | 'headphones'): CSSProperties {
  const head = HEAD[species]
  switch (slot) {
    case 'head':
      return {
        left: `${head.x}%`,
        top: `${head.top}%`,
        width: `${head.w * 1.05}%`,
        transform: 'translate(-50%, -78%) rotate(-8deg)',
      }
    case 'headphones':
      // Bei großen Gesichtern von vorn sitzen die Muscheln seitlich, nicht über den Augen.
      return {
        left: `${head.x}%`,
        top: `${head.top}%`,
        width: `${head.w * (head.w > 40 ? 1.3 : 1.2)}%`,
        transform: `translate(-50%, ${head.w > 40 ? -55 : -30}%)`,
      }
    case 'face':
      return {
        left: `${head.x}%`,
        top: `${head.eye}%`,
        width: `${head.w * 0.9}%`,
        transform: 'translate(-50%, -50%)',
      }
    case 'toy':
      return { bottom: '-4%', right: '-30%', width: '42%' }
  }
}

/** Kulisse: Häuschen und Sonnenblume stehen am Boden, Regenbogen und Planet am Himmel. */
const PLACE_STYLE: Record<string, CSSProperties> = {
  house: { bottom: '9%', left: '1%', width: '44%' },
  sunflower: { bottom: '9%', right: '3%', width: '24%' },
  rainbow: { top: '2%', left: '2%', width: '58%', opacity: 0.85 },
  ringed_planet: { top: '4%', left: '6%', width: '24%' },
}

/** Untere Eierschale, in der das Baby sitzt (eigene Zeichnung). */
function Shell({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 50" aria-hidden="true" className={className}>
      <path
        d="M4 8 L16 0 L28 10 L40 1 L52 11 L64 2 L76 10 L88 1 L96 9 C98 30 80 50 50 50 C20 50 2 30 4 8 Z"
        fill="#fdf4e3"
        stroke="#e7c9a0"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <ellipse cx="34" cy="30" rx="7" ry="4" fill="#f3dcb8" />
      <ellipse cx="66" cy="36" rx="5" ry="3" fill="#f3dcb8" />
    </svg>
  )
}

/** Risse im Ei, sobald es den ersten Tag versorgt wurde. */
function Cracks() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className="absolute inset-0 size-full">
      <path
        d="M30 44 L40 52 L46 42 L56 54 L62 44 L70 50"
        fill="none"
        stroke="#8a6a44"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

interface FigureProps {
  species: Species
  stage: Stage
  careDays: number
  equipped: Partial<Record<ItemSlot, string>>
  mood: Mood
  /** Bewegung für den Moment (Kunststück, Fressen, Streicheln); wechselt mit `actionKey`. */
  motion?: string
  actionKey?: number
}

/** Das Tier auf seiner Bühne, mit Zubehör und Stimmung. Rein gezeichnet, ohne Text. */
export function CompanionFigure({
  species,
  stage,
  careDays,
  equipped,
  mood,
  motion,
  actionKey,
}: FigureProps) {
  const Animal = SPECIES_ICONS[species]
  const Place = equipped.place ? ITEM_ICONS[equipped.place] : undefined
  const idle =
    mood === 'sleepy'
      ? 'animate-pet-breathe'
      : mood === 'party'
        ? 'animate-pet-dance'
        : mood === 'hungry'
          ? 'animate-pet-beg'
          : 'animate-pet-bob'

  return (
    <div className="relative aspect-square w-full">
      {Place && equipped.place && (
        <Place
          aria-hidden="true"
          className="absolute"
          style={{
            height: 'auto',
            ...(PLACE_STYLE[equipped.place] ?? { top: '4%', left: '4%', width: '30%' }),
          }}
        />
      )}
      {/* Schatten auf dem Boden */}
      <div className="absolute bottom-[8%] left-1/2 h-[6%] w-[46%] -translate-x-1/2 rounded-[50%] bg-slate-900/10" />
      {stage === 'egg' && motion && (
        // Das Ei leuchtet bei jeder Portion und jedem Tipp kurz auf.
        <div
          key={`glow-${actionKey}`}
          aria-hidden="true"
          className="absolute bottom-[4%] left-1/2 aspect-square w-[70%] -translate-x-1/2 animate-egg-glow rounded-full bg-[radial-gradient(circle,_rgba(253,224,71,0.85)_0%,_rgba(251,191,36,0.45)_40%,_transparent_70%)] opacity-0"
        />
      )}
      {stage === 'egg' ? (
        <div
          key={actionKey}
          className={`absolute bottom-[10%] left-1/2 w-[38%] -translate-x-1/2 ${motion ?? 'animate-egg-wobble'}`}
        >
          <div className="relative">
            <EggIcon aria-hidden="true" className="size-full" style={{ height: 'auto' }} />
            {careDays > 0 && <Cracks />}
          </div>
        </div>
      ) : (
        <div
          className="absolute bottom-[10%] left-1/2 -translate-x-1/2"
          style={{ width: STAGE_SIZE[stage] }}
        >
          <div key={actionKey} className={`relative origin-bottom ${motion ?? idle}`}>
            <Animal
              aria-hidden="true"
              className="block size-full"
              style={{ height: 'auto', ...SPECIES_STYLE[species] }}
            />
            {stage === 'teen' && !equipped.head && (
              // Der Teenager trägt Kopfhörer, solange er keinen Kopfschmuck aufhat.
              <HeadphoneIcon
                aria-hidden="true"
                className="absolute"
                style={{ height: 'auto', ...slotStyle(species, 'headphones') }}
              />
            )}
            {(['head', 'face', 'toy'] as const).map((slot) => {
              const Item = equipped[slot] ? ITEM_ICONS[equipped[slot]] : undefined
              return Item ? (
                <Item
                  key={slot}
                  aria-hidden="true"
                  className="absolute"
                  style={{ height: 'auto', ...slotStyle(species, slot) }}
                />
              ) : null
            })}
          </div>
          {stage === 'baby' && <Shell className="absolute -bottom-[8%] left-[-8%] w-[116%]" />}
        </div>
      )}
      {mood === 'sleepy' && stage !== 'egg' && (
        <span
          aria-hidden="true"
          className="absolute top-[18%] right-[18%] animate-zzz text-4xl font-extrabold text-sky-400"
        >
          z<span className="text-2xl">z</span>
        </span>
      )}
    </div>
  )
}

/** Steigende Herzen, Noten, Funken … um das Tier herum. */
export function Particles({ icons, burstKey }: { icons: Icon[]; burstKey: number }) {
  const spots = [12, 30, 50, 68, 84, 22, 60, 40]
  return (
    <div key={burstKey} aria-hidden="true" className="pointer-events-none absolute inset-0">
      {spots.map((left, index) => {
        const Particle = icons[index % icons.length]
        return (
          <Particle
            key={index}
            className="absolute size-12 animate-particle opacity-0"
            style={{
              left: `${left}%`,
              bottom: `${20 + (index % 3) * 12}%`,
              animationDelay: `${index * 110}ms`,
            }}
          />
        )
      })}
    </div>
  )
}
