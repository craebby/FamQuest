import type { ComponentType, CSSProperties, SVGProps } from 'react'
import BalloonIcon from '~icons/fluent-emoji-flat/balloon'
import BilledCapIcon from '~icons/fluent-emoji-flat/billed-cap'
import BoneIcon from '~icons/fluent-emoji-flat/bone'
import BubblesIcon from '~icons/fluent-emoji-flat/bubbles'
import CarrotIcon from '~icons/fluent-emoji-flat/carrot'
import CatIcon from '~icons/fluent-emoji-flat/cat'
import CherryBlossomIcon from '~icons/fluent-emoji-flat/cherry-blossom'
import CrownIcon from '~icons/fluent-emoji-flat/crown'
import CycloneIcon from '~icons/fluent-emoji-flat/cyclone'
import DogIcon from '~icons/fluent-emoji-flat/dog'
import DolphinIcon from '~icons/fluent-emoji-flat/dolphin'
import DragonIcon from '~icons/fluent-emoji-flat/dragon'
import FireworksIcon from '~icons/fluent-emoji-flat/fireworks'
import FishIcon from '~icons/fluent-emoji-flat/fish'
import FoxIcon from '~icons/fluent-emoji-flat/fox'
import GiraffeIcon from '~icons/fluent-emoji-flat/giraffe'
import GlassesIcon from '~icons/fluent-emoji-flat/glasses'
import GlowingStarIcon from '~icons/fluent-emoji-flat/glowing-star'
import GrapesIcon from '~icons/fluent-emoji-flat/grapes'
import HeartIcon from '~icons/fluent-emoji-flat/red-heart'
import HorseIcon from '~icons/fluent-emoji-flat/horse'
import HotPepperIcon from '~icons/fluent-emoji-flat/hot-pepper'
import HouseIcon from '~icons/fluent-emoji-flat/house'
import KiteIcon from '~icons/fluent-emoji-flat/kite'
import KoalaIcon from '~icons/fluent-emoji-flat/koala'
import LeafyGreenIcon from '~icons/fluent-emoji-flat/leafy-green'
import LeopardIcon from '~icons/fluent-emoji-flat/leopard'
import MagicWandIcon from '~icons/fluent-emoji-flat/magic-wand'
import MeatIcon from '~icons/fluent-emoji-flat/meat-on-bone'
import NotesIcon from '~icons/fluent-emoji-flat/musical-notes'
import PandaIcon from '~icons/fluent-emoji-flat/panda'
import PenguinIcon from '~icons/fluent-emoji-flat/penguin'
import RabbitIcon from '~icons/fluent-emoji-flat/rabbit'
import RainbowIcon from '~icons/fluent-emoji-flat/rainbow'
import RibbonIcon from '~icons/fluent-emoji-flat/ribbon'
import PlanetIcon from '~icons/fluent-emoji-flat/ringed-planet'
import RocketIcon from '~icons/fluent-emoji-flat/rocket'
import ShoeIcon from '~icons/fluent-emoji-flat/running-shoe'
import SharkIcon from '~icons/fluent-emoji-flat/shark'
import ShortcakeIcon from '~icons/fluent-emoji-flat/shortcake'
import SoccerIcon from '~icons/fluent-emoji-flat/soccer-ball'
import SparklesIcon from '~icons/fluent-emoji-flat/sparkles'
import StrawberryIcon from '~icons/fluent-emoji-flat/strawberry'
import SunflowerIcon from '~icons/fluent-emoji-flat/sunflower'
import SunglassesIcon from '~icons/fluent-emoji-flat/sunglasses'
import TeddyIcon from '~icons/fluent-emoji-flat/teddy-bear'
import TopHatIcon from '~icons/fluent-emoji-flat/top-hat'
import TurtleIcon from '~icons/fluent-emoji-flat/turtle'
import UnicornIcon from '~icons/fluent-emoji-flat/unicorn'
import YoYoIcon from '~icons/fluent-emoji-flat/yo-yo'

import type { Species, Trick } from '../../api/companions'

export type Icon = ComponentType<SVGProps<SVGSVGElement>>

export const SPECIES_ICONS: Record<Species, Icon> = {
  cat: CatIcon,
  dog: DogIcon,
  fox: FoxIcon,
  dragon: DragonIcon,
  unicorn: UnicornIcon,
  horse: HorseIcon,
  snow_leopard: LeopardIcon,
  giraffe: GiraffeIcon,
  turtle: TurtleIcon,
  shark: SharkIcon,
  dolphin: DolphinIcon,
  panda: PandaIcon,
  rabbit: RabbitIcon,
  penguin: PenguinIcon,
  koala: KoalaIcon,
}

/** Eigene Note: der Schneeleopard ist der Leopard in Weiß und Eisblau. */
export const SPECIES_STYLE: Partial<Record<Species, CSSProperties>> = {
  snow_leopard: { filter: 'grayscale(1) brightness(1.25) sepia(0.15) hue-rotate(170deg)' },
}

/** Lieblingsfutter je Tier; jede erledigte Aufgabe ist eine Portion. */
export const FOOD_ICONS: Record<Species, Icon> = {
  cat: FishIcon,
  dog: BoneIcon,
  fox: GrapesIcon,
  dragon: HotPepperIcon,
  unicorn: ShortcakeIcon,
  horse: CarrotIcon,
  snow_leopard: MeatIcon,
  giraffe: LeafyGreenIcon,
  turtle: StrawberryIcon,
  shark: FishIcon,
  dolphin: FishIcon,
  panda: LeafyGreenIcon,
  rabbit: CarrotIcon,
  penguin: FishIcon,
  koala: LeafyGreenIcon,
}

export const ITEM_ICONS: Record<string, Icon> = {
  ribbon: RibbonIcon,
  cherry_blossom: CherryBlossomIcon,
  billed_cap: BilledCapIcon,
  top_hat: TopHatIcon,
  crown: CrownIcon,
  glasses: GlassesIcon,
  sunglasses: SunglassesIcon,
  balloon: BalloonIcon,
  yo_yo: YoYoIcon,
  soccer_ball: SoccerIcon,
  teddy_bear: TeddyIcon,
  kite: KiteIcon,
  sunflower: SunflowerIcon,
  rainbow: RainbowIcon,
  ringed_planet: PlanetIcon,
  house: HouseIcon,
}

interface TrickArt {
  icon: Icon
  /** Bewegung des Tiers (Klasse aus index.css). */
  motion: string
  /** Was dabei um das Tier herum aufsteigt. */
  particles: Icon[]
}

export const TRICKS: Record<Trick, TrickArt> = {
  spin: { icon: CycloneIcon, motion: 'animate-pet-spin', particles: [SparklesIcon] },
  jump: { icon: ShoeIcon, motion: 'animate-pet-jump', particles: [SparklesIcon, GlowingStarIcon] },
  music: { icon: NotesIcon, motion: 'animate-pet-dance', particles: [NotesIcon] },
  bubbles: { icon: BubblesIcon, motion: 'animate-pet-wiggle', particles: [BubblesIcon] },
  rainbow: { icon: RainbowIcon, motion: 'animate-pet-hop', particles: [RainbowIcon, HeartIcon] },
  fireworks: {
    icon: FireworksIcon,
    motion: 'animate-pet-jump',
    particles: [FireworksIcon, SparklesIcon],
  },
  rocket: { icon: RocketIcon, motion: 'animate-pet-rocket', particles: [RocketIcon, SparklesIcon] },
  magic: {
    icon: MagicWandIcon,
    motion: 'animate-pet-magic',
    particles: [MagicWandIcon, GlowingStarIcon, SparklesIcon],
  },
}

export { HeartIcon, SparklesIcon }
