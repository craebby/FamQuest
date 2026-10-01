import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Chore, ChorePlan } from '../api/chores'
import i18n from '../i18n'
import { makeChore, makeMe, makeMember, mockApi, renderApp, setupDone } from '../test/utils'

beforeEach(async () => {
  await i18n.changeLanguage('de')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const mama = makeMember({ id: 3, name: 'Mama', role: 'parent', color: 'blue' })
const lena = makeMember({ id: 1, name: 'Lena', color: 'purple' })

const toilet = makeChore({
  id: 1,
  room_id: 1,
  title: 'Toilette putzen',
  interval_days: 7,
  days_left: -3,
  ratio: 1.43,
  level: 'due',
})
const floor = makeChore({
  id: 2,
  room_id: 1,
  title: 'Boden wischen',
  days_left: 2,
  ratio: 0.86,
  level: 'soon',
})
const windows = makeChore({
  id: 3,
  room_id: 2,
  title: 'Fenster putzen',
  icon: 'fluent-emoji-flat:window',
  interval_days: 180,
  days_left: 150,
  ratio: 0.17,
  level: 'ok',
})
const vacuumed = makeChore({
  id: 4,
  room_id: 2,
  title: 'Staubsaugen',
  icon: 'fluent-emoji-flat:broom',
  interval_days: 7,
  days_left: 7,
  ratio: 0,
  done_today: true,
  done_by: 3,
  last_done: '2026-10-03',
})
const paused = makeChore({ id: 5, room_id: 2, title: 'Rasen mähen', active: false })

const PLAN: ChorePlan = {
  date: '2026-10-03',
  rooms: [
    { id: 1, name: 'Bad oben', icon: 'fluent-emoji-flat:bathtub' },
    { id: 2, name: 'Überall', icon: 'fluent-emoji-flat:broom' },
  ],
  chores: [windows, vacuumed, paused, floor, toilet],
}

/** Merkt sich wie der Server, was erledigt ist; das Display lädt nach jedem Tipp neu. */
function mockChores(plan: ChorePlan = PLAN) {
  let chores = plan.chores
  const replace = (chore: Chore) => {
    chores = chores.map((item) => (item.id === chore.id ? chore : item))
    return Response.json(chore)
  }
  return mockApi({
    'GET /api/setup/status': setupDone,
    'GET /api/auth/me': Response.json(makeMe()),
    'GET /api/members': Response.json([lena, mama]),
    'GET /api/chores': () => Response.json({ ...plan, chores }),
    'PUT /api/chores/1/done': (body) =>
      replace({
        ...toilet,
        done_today: true,
        done_by: (body as { member_id: number | null }).member_id,
        days_left: 7,
        ratio: 0,
        level: 'ok',
      }),
    'DELETE /api/chores/1/done': () => replace(toilet),
    'DELETE /api/chores/4/done': () => replace({ ...vacuumed, done_today: false, done_by: null }),
  })
}

const bodiesOf = (calls: ReturnType<typeof mockApi>, key: string) =>
  calls.filter((call) => call.key === key).map((call) => call.body)

const titlesIn = (name: string) =>
  within(screen.getByRole('region', { name }))
    .getAllByRole('button')
    .map((button) => button.textContent)

describe('Haushalt', () => {
  it('ist über die Navigationsleiste erreichbar', async () => {
    const user = userEvent.setup()
    mockChores()
    renderApp('/meals')

    await user.click(await screen.findByRole('link', { name: 'Haushalt' }))

    expect(await screen.findByRole('heading', { name: 'Haushalt', level: 1 })).toBeVisible()
  })

  it('ordnet nach Ampel: fällig, bald dran, hat noch Zeit, darunter heute Erledigtes', async () => {
    mockChores()
    renderApp('/household')

    const due = await screen.findByRole('button', { name: /Toilette putzen/ })
    expect(due).toHaveTextContent('Bad oben · jede Woche')
    expect(due).toHaveTextContent('Seit 3 Tagen fällig')
    expect(due).toHaveAttribute('aria-pressed', 'false')
    expect(titlesIn('Jetzt dran')).toHaveLength(1)
    expect(titlesIn('Bald dran')[0]).toContain('Boden wischen')
    expect(titlesIn('Hat noch Zeit')[0]).toContain('In etwa 5 Monaten')

    const done = within(screen.getByRole('region', { name: 'Heute erledigt' }))
    expect(done.getByRole('button', { name: /Staubsaugen/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(done.getByRole('img', { name: 'Erledigt von Mama' })).toBeVisible()
    // Pausierte Aufgaben erscheinen am Display nicht.
    expect(screen.queryByText('Rasen mähen')).toBeNull()
  })

  it('zeigt auf Wunsch die Räume, das Dringendste jeweils zuerst', async () => {
    const user = userEvent.setup()
    mockChores()
    renderApp('/household')

    await user.click(await screen.findByRole('button', { name: 'Nach Raum' }))

    const bath = titlesIn('Bad oben')
    expect(bath[0]).toContain('Toilette putzen')
    expect(bath[1]).toContain('Boden wischen')
    // Unter dem Raum steht der Raumname nicht noch einmal in jeder Zeile.
    expect(bath[0]).not.toContain('Bad oben')
    const everywhere = titlesIn('Überall')
    expect(everywhere[0]).toContain('Fenster putzen')
    expect(everywhere[1]).toContain('Staubsaugen')
  })

  it('erledigt per Tipp und fragt danach, wer es war', async () => {
    const user = userEvent.setup()
    const calls = mockChores()
    renderApp('/household')

    await user.click(await screen.findByRole('button', { name: /Toilette putzen/ }))

    const who = within(await screen.findByRole('region', { name: 'Wer war’s?' }))
    expect(who.getByRole('status')).toHaveTextContent('„Toilette putzen“ ist erledigt.')
    // Erwachsene stehen vorn.
    expect(who.getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual([
      'Mama',
      'Lena',
      null,
      'Schließen',
    ])

    await user.click(who.getByRole('button', { name: 'Mama' }))

    expect(bodiesOf(calls, 'PUT /api/chores/1/done')).toEqual([
      { member_id: null },
      { member_id: 3 },
    ])
    expect(screen.queryByRole('region', { name: 'Wer war’s?' })).toBeNull()
  })

  it('nimmt einen falschen Tipp über „Rückgängig“ zurück', async () => {
    const user = userEvent.setup()
    const calls = mockChores()
    renderApp('/household')

    await user.click(await screen.findByRole('button', { name: /Toilette putzen/ }))
    await user.click(await screen.findByRole('button', { name: 'Rückgängig' }))

    expect(calls.map((call) => call.key)).toContain('DELETE /api/chores/1/done')
    expect(screen.queryByRole('region', { name: 'Wer war’s?' })).toBeNull()
  })

  it('nimmt heute Erledigtes mit einem weiteren Tipp zurück', async () => {
    const user = userEvent.setup()
    const calls = mockChores()
    renderApp('/household')

    await user.click(await screen.findByRole('button', { name: /Staubsaugen/ }))

    expect(calls.map((call) => call.key)).toContain('DELETE /api/chores/4/done')
  })

  it('lobt, wenn nichts dran ist', async () => {
    mockChores({ ...PLAN, chores: [windows] })
    renderApp('/household')

    expect(
      await screen.findByText('Alles im grünen Bereich. Gerade ist nichts dran.'),
    ).toBeVisible()
    expect(screen.queryByRole('region', { name: 'Jetzt dran' })).toBeNull()
  })

  it('führt ohne Putzplan zur Einrichtung im Elternbereich', async () => {
    mockChores({ date: '2026-10-03', rooms: [], chores: [] })
    renderApp('/household')

    const link = await screen.findByRole('link', { name: /Noch kein Putzplan/ })
    expect(link).toHaveAttribute('href', '/parents/household')
    expect(screen.queryByRole('button', { name: 'Nach Raum' })).toBeNull()
  })
})
