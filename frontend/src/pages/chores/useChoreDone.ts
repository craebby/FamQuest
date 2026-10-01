import { useEffect, useState } from 'react'

import { type Chore, useMarkDone, useUndoDone } from '../../api/chores'

/** So lange bleibt die Frage „Wer war's?“ nach dem Erledigen stehen. */
export const WHO_TIMEOUT_MS = 12 * 1000

/**
 * Ein Tipp erledigt eine Hausarbeit, ein weiterer am selben Tag nimmt es zurück. Nach dem
 * Erledigen steht kurz die Frage „Wer war's?“ (siehe WhoBar). Gemeinsam für die Ansicht
 * „Haushalt“, die Kachel auf „Heute“ und die Spalte unter „Aufgaben“.
 */
export function useChoreDone(chores: Chore[]) {
  const markDone = useMarkDone()
  const undoDone = useUndoDone()
  // Gerade erledigte Aufgabe, zu der noch gefragt wird, wer es war.
  const [askingId, setAskingId] = useState<number | null>(null)

  useEffect(() => {
    if (askingId === null) return
    const timer = window.setTimeout(() => setAskingId(null), WHO_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [askingId])

  const toggle = (chore: Chore) => {
    if (chore.done_today) {
      setAskingId(null)
      undoDone.mutate(chore.id)
    } else {
      markDone.mutate({ id: chore.id, memberId: null }, { onSuccess: () => setAskingId(chore.id) })
    }
  }

  return {
    toggle,
    /** Aufgabe, zu der die Leiste „Wer war's?“ gerade fragt. */
    asking: chores.find((chore) => chore.id === askingId && chore.done_today),
    pick: (chore: Chore, memberId: number) => {
      markDone.mutate({ id: chore.id, memberId })
      setAskingId(null)
    },
    close: () => setAskingId(null),
    error: markDone.error ?? undoDone.error,
  }
}

export type ChoreDone = ReturnType<typeof useChoreDone>
