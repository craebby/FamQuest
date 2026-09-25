import { useEffect, useRef } from 'react'

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const

/** Ruft `onIdle` auf, wenn so lange keine Eingabe erfolgt ist. */
export function useIdleTimeout(timeoutMs: number, onIdle: () => void) {
  const onIdleRef = useRef(onIdle)
  useEffect(() => {
    onIdleRef.current = onIdle
  })

  useEffect(() => {
    let timer = window.setTimeout(() => onIdleRef.current(), timeoutMs)
    const reset = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => onIdleRef.current(), timeoutMs)
    }
    for (const event of ACTIVITY_EVENTS) window.addEventListener(event, reset, { passive: true })
    return () => {
      window.clearTimeout(timer)
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, reset)
    }
  }, [timeoutMs])
}
