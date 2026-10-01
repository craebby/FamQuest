import { useTranslation } from 'react-i18next'

/** Das FamQuest-Logo für Anmeldung und Ersteinrichtung; die Datei liegt lokal in `public/`. */
export function Logo() {
  const { t } = useTranslation()
  return (
    <img src="/logo.webp" alt={t('app.name')} width={512} height={512} className="mx-auto w-64" />
  )
}
