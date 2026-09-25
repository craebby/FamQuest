import { useEffect, useState } from 'react'

/** Temporäre URL für eine Datei oder ein Blob; wird beim Wechsel wieder freigegeben. */
export function useObjectUrl(blob: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!blob) {
      // oxlint-disable-next-line react/set-state-in-effect
      setUrl(null)
      return
    }
    // Die URL ist eine externe Ressource: im Effekt anlegen und im Cleanup freigeben
    // (useMemo würde unter StrictMode eine bereits freigegebene URL weiterverwenden).
    const objectUrl = URL.createObjectURL(blob)
    // oxlint-disable-next-line react/set-state-in-effect
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [blob])
  return url
}
