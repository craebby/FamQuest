import { TaskIcon } from './TaskIcon'

interface DishPictureProps {
  icon: string
  /** Eigenes Foto des Gerichts; ersetzt das Symbol. */
  imageUrl: string | null
  className?: string
}

/** Foto eines Gerichts, sonst sein Symbol; beides schmückt nur (der Name steht daneben). */
export function DishPicture({ icon, imageUrl, className = 'size-14' }: DishPictureProps) {
  if (!imageUrl) return <TaskIcon icon={icon} className={className} />
  return (
    <img
      src={imageUrl}
      alt=""
      loading="lazy"
      className={`shrink-0 rounded-2xl object-cover ${className}`}
    />
  )
}
