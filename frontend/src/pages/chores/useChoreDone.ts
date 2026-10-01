import { useEffect, useState } from 'react'

import {
  type Chore,
  type Todo,
  useMarkDone,
  useTodoDone,
  useTodoUndo,
  useUndoDone,
} from '../../api/chores'

/** So lange bleibt die Frage „Wer war's?“ nach dem Erledigen stehen. */
export const WHO_TIMEOUT_MS = 12 * 1000

/**
 * Ein Tipp erledigt eine Hausarbeit oder einen Eintrag aus „Zu erledigen“, ein weiterer am selben
 * Tag nimmt es zurück. Nach dem Erledigen steht kurz die Frage „Wer war's?“ (siehe WhoBar).
 * Gemeinsam für die Ansicht „Haushalt“, die Kachel auf „Heute“ und die Spalte unter „Aufgaben“.
 */
export function useChoreDone(chores: Chore[], todos: Todo[] = []) {
  const markDone = useMarkDone()
  const undoDone = useUndoDone()
  const todoDone = useTodoDone()
  const todoUndo = useTodoUndo()
  // Gerade Erledigtes, zu dem noch gefragt wird, wer es war.
  const [asking, setAsking] = useState<{ kind: 'chore' | 'todo'; id: number } | null>(null)

  useEffect(() => {
    if (asking === null) return
    const timer = window.setTimeout(() => setAsking(null), WHO_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [asking])

  const close = () => setAsking(null)

  const toggle = (chore: Chore) => {
    if (chore.done_today) {
      close()
      undoDone.mutate(chore.id)
    } else {
      markDone.mutate(
        { id: chore.id, memberId: null },
        { onSuccess: () => setAsking({ kind: 'chore', id: chore.id }) },
      )
    }
  }

  const toggleTodo = (todo: Todo) => {
    if (todo.done) {
      close()
      todoUndo.mutate(todo.id)
    } else {
      todoDone.mutate(
        { id: todo.id, memberId: null },
        { onSuccess: () => setAsking({ kind: 'todo', id: todo.id }) },
      )
    }
  }

  const chore =
    asking?.kind === 'chore'
      ? chores.find((item) => item.id === asking.id && item.done_today)
      : undefined
  const todo =
    asking?.kind === 'todo' ? todos.find((item) => item.id === asking.id && item.done) : undefined

  return {
    toggle,
    toggleTodo,
    /** Wozu die Leiste „Wer war's?“ gerade fragt. */
    asking: chore
      ? {
          title: chore.title,
          pick: (memberId: number) => {
            markDone.mutate({ id: chore.id, memberId })
            close()
          },
          undo: () => toggle(chore),
        }
      : todo
        ? {
            title: todo.title,
            pick: (memberId: number) => {
              todoDone.mutate({ id: todo.id, memberId })
              close()
            },
            undo: () => toggleTodo(todo),
          }
        : undefined,
    close,
    error: markDone.error ?? undoDone.error ?? todoDone.error ?? todoUndo.error,
  }
}

export type ChoreDone = ReturnType<typeof useChoreDone>
