import { colorTokens } from '../memberColors'

const SIZES = {
  sm: { box: 'size-12', ring: 'p-0.5', text: 'text-xl' },
  md: { box: 'size-20', ring: 'p-1', text: 'text-3xl' },
  lg: { box: 'size-32', ring: 'p-1.5', text: 'text-5xl' },
  xl: { box: 'size-44', ring: 'p-2', text: 'text-7xl' },
} as const

interface AvatarProps {
  name: string
  color: string
  /** Bild-URL; ohne Bild erscheint die Initiale auf der Personenfarbe. */
  src?: string | null
  size?: keyof typeof SIZES
  /** Ohne `label` gilt der Avatar als Schmuck (der Name steht daneben). */
  label?: string
}

function initial(name: string) {
  return (Array.from(name.trim())[0] ?? '?').toLocaleUpperCase()
}

/** Rundes Profilbild mit Farbring in der Personenfarbe. */
export function Avatar({ name, color, src, size = 'md', label }: AvatarProps) {
  const tokens = colorTokens(color)
  const { box, ring, text } = SIZES[size]
  return (
    <span
      className={`inline-flex shrink-0 rounded-full ${box} ${ring}`}
      style={{ backgroundColor: tokens.main }}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      <span
        className="flex size-full items-center justify-center overflow-hidden rounded-full ring-2 ring-white"
        style={{ backgroundColor: tokens.main, color: tokens.onMain }}
      >
        {src ? (
          <img src={src} alt="" className="size-full object-cover" draggable={false} />
        ) : (
          <span className={`font-extrabold ${text}`}>{initial(name)}</span>
        )}
      </span>
    </span>
  )
}
