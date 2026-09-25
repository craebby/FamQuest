import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError } from '../../api/client'
import { type Member, useMembers } from '../../api/members'
import { type TodayTask, daysUntilDue, doneBy, isPendingFor, useSetDone } from '../../api/today'

/** So lange ist „+2 Punkte“ nach dem Abhaken zu sehen (auch ohne Animation). */
export const POINTS_FEEDBACK_MS = 1200

/**
 * Zustand einer Aufgabe für eine Person und was ein Tipp auslöst: erledigen bzw. zurücknehmen,
 * dazu die Haken-Animation und „+2 Punkte“. Gemeinsam für Karten und die Symbole der Startseite.
 */
export function useTaskToggle(task: TodayTask, member: Member, date: string) {
  const { t } = useTranslation()
  const setDone = useSetDone(task.id, member.id)
  // Die Haken-Animation gibt es nur direkt nach dem Antippen, nicht bei jedem Laden.
  const [tapped, setTapped] = useState(false)
  // Zähler für „+2 Punkte“; jeder neue Tipp startet die Anzeige neu (0 = nichts anzeigen).
  const [feedback, setFeedback] = useState(0)
  useEffect(() => {
    if (!feedback) return
    const timer = window.setTimeout(() => setFeedback(0), POINTS_FEEDBACK_MS)
    return () => window.clearTimeout(timer)
  }, [feedback])
  const members = useMembers().data
  const completer = doneBy(task, member.id)
  const done = completer !== null
  // „Einer für alle“, von jemand anderem erledigt: dessen Avatar statt des Hakens.
  const doneByOther =
    completer !== null && completer !== member.id
      ? members?.find((candidate) => candidate.id === completer)
      : undefined
  // Erledigt, aber die Eltern müssen noch prüfen: Sanduhr statt Haken, noch keine Punkte.
  const pending = isPendingFor(task, member.id)
  // Flexible Aufgaben: negativ = überfällig, positiv = demnächst.
  const dueIn = daysUntilDue(task, member.id, date)
  // Erwachsene sammeln keine Punkte; bei ihnen zählt nur, dass es erledigt ist.
  const showPoints = member.role !== 'parent'
  // Ein Tageswechsel wird still behoben: die Ansicht lädt den neuen Tag.
  const error =
    setDone.error instanceof ApiError && setDone.error.code === 'completion.day_changed'
      ? null
      : setDone.error
  const label = [
    showPoints
      ? t('family.task_label', {
          title: task.title,
          points: t('tasks.points_count', { count: task.points }),
        })
      : task.title,
    ...(pending ? [t('family.pending')] : []),
    ...(doneByOther ? [t('family.done_by', { name: doneByOther.name })] : []),
    ...(dueIn !== null && dueIn < 0 ? [t('family.overdue', { count: -dueIn })] : []),
    ...(dueIn !== null && dueIn > 0 ? [t('family.due_in', { count: dueIn })] : []),
  ].join(', ')

  const toggle = () => {
    setTapped(true)
    if (!done && showPoints && task.points > 0) setFeedback((count) => count + 1)
    setDone.mutate({ date, taskId: task.id, memberId: member.id, done: !done })
  }

  return { done, doneByOther, pending, dueIn, showPoints, tapped, feedback, error, label, toggle }
}
