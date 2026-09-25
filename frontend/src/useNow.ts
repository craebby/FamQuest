import { useEffect, useState } from 'react'

/** Aktuelle Zeit, alle `intervalMs` neu (für Uhren). */
export function useNow(intervalMs = 5000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs])
  return now
}
