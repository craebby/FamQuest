import { useTranslation } from 'react-i18next'

import {
  type Companion,
  STAGE_STARTS,
  type Stage,
  TRICK_STARTS,
  type Trick,
} from '../../api/companions'

/**
 * Testmodus (nur mit `?test=1` in der Adresse): Pflegetage und Portionen nur in der Anzeige
 * verstellen, um die Stufen durchzuklicken. Es wird nichts gespeichert.
 */
export interface TestState {
  days: number
  food: number
  allDone: boolean
}

const MAX_DAYS = 60

/** Das Tier so, wie es nach `days` Pflegetagen aussähe (wie stage_for/tricks_for im Backend). */
export function previewCompanion(companion: Companion, days: number): Companion {
  const stages = Object.entries(STAGE_STARTS) as [Stage, number][]
  const tricks = Object.entries(TRICK_STARTS) as [Trick, number][]
  const stage = stages.filter(([, start]) => days >= start).at(-1)?.[0] ?? 'egg'
  return {
    ...companion,
    care_days: days,
    stage,
    next_stage_at: stages.find(([, start]) => days < start)?.[1] ?? null,
    tricks: tricks.filter(([, start]) => days >= start).map(([trick]) => trick),
    next_trick_at: tricks.find(([, start]) => days < start)?.[1] ?? null,
  }
}

export function TestPanel({
  state,
  onChange,
  onExit,
}: {
  state: TestState
  onChange: (state: TestState) => void
  onExit: () => void
}) {
  const { t } = useTranslation()
  const setDays = (days: number) =>
    onChange({ ...state, days: Math.max(0, Math.min(MAX_DAYS, days)) })
  const jumps: [string, number][] = [
    ...(Object.entries(STAGE_STARTS) as [Stage, number][]).map(
      ([stage, start]) => [t(`companion.stage.${stage}`), start] as [string, number],
    ),
    [t('companion.test.cracked'), 1],
    [t('companion.trick.magic'), MAX_DAYS],
  ]
  const chip =
    'rounded-2xl bg-white px-4 py-2 text-lg font-bold text-slate-800 shadow-sm hover:bg-amber-100 focus-visible:outline-4 focus-visible:outline-orange-400'

  return (
    <section
      aria-label={t('companion.test.title')}
      className="flex flex-col gap-3 rounded-3xl border-4 border-dashed border-amber-400 bg-amber-50 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-extrabold text-amber-900">{t('companion.test.title')}</h2>
        <button type="button" className={chip} onClick={onExit}>
          {t('companion.test.exit')}
        </button>
      </div>
      <p className="text-amber-900">{t('companion.test.hint')}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={chip} onClick={() => setDays(state.days - 1)}>
          {t('companion.test.day_minus')}
        </button>
        <span className="min-w-32 text-center text-xl font-extrabold text-slate-800 tabular-nums">
          {t('companion.care_days', { count: state.days })}
        </span>
        <button type="button" className={chip} onClick={() => setDays(state.days + 1)}>
          {t('companion.test.day_plus')}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {jumps
          .sort((a, b) => a[1] - b[1])
          .map(([label, days]) => (
            <button
              key={days}
              type="button"
              aria-pressed={state.days === days}
              className={`${chip} ${state.days === days ? 'ring-4 ring-amber-400' : ''}`}
              onClick={() => setDays(days)}
            >
              {label} ({days})
            </button>
          ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={chip}
          onClick={() => onChange({ ...state, food: state.food + 1 })}
        >
          {t('companion.test.food_plus')}
        </button>
        <button
          type="button"
          className={chip}
          onClick={() => onChange({ ...state, food: 0, allDone: false })}
        >
          {t('companion.test.food_reset')}
        </button>
        <button
          type="button"
          aria-pressed={state.allDone}
          className={`${chip} ${state.allDone ? 'ring-4 ring-amber-400' : ''}`}
          onClick={() => onChange({ ...state, allDone: !state.allDone })}
        >
          {t('companion.test.all_done')}
        </button>
      </div>
    </section>
  )
}
