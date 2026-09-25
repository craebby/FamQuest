import { DEFAULT_TASK_ICON, ICON_VIEWBOX, iconBody } from '../icons/catalog'

interface TaskIconProps {
  icon: string
  className?: string
  /** Ohne `label` gilt das Icon als Schmuck (der Titel steht daneben). */
  label?: string
}

/** Aufgaben-Icon aus dem lokal gebündelten Katalog. */
export function TaskIcon({ icon, className = 'size-12', label }: TaskIconProps) {
  // Unbekannte Icons (z. B. nach einer Änderung am Katalog) erscheinen als Haken.
  const body = iconBody(icon) ?? iconBody(DEFAULT_TASK_ICON) ?? ''
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={ICON_VIEWBOX}
      className={`shrink-0 ${className}`}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      // Inhalt stammt ausschließlich aus dem beim Build eingebetteten Icon-Set.
      dangerouslySetInnerHTML={{ __html: body }}
    />
  )
}
