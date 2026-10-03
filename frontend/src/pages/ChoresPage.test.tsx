import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Chore, ChorePlan, Todo } from '../api/chores'
import i18n from '../i18n'
import {
  makeChore,
  makeChorePlan,
  makeMe,
  makeMember,
  makeTodo,
  mockApi,
  renderApp,
  setupDone,
} from '../test/utils'

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

const PLAN = makeChorePlan({
  rooms: [
    { id: 1, name: 'Bad oben', icon: 'fluent-emoji-flat:bathtub' },
    { id: 2, name: 'Überall', icon: 'fluent-emoji-flat:broom' },
  ],
  chores: [windows, vacuumed, paused, floor, toilet],
})

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

  it('zeigt die faire Verteilung aus „Wer war’s?“', async () => {
    mockChores({
      ...PLAN,
      shares: [
        { member_id: 3, count: 3 },
        { member_id: 1, count: 1 },
      ],
    })
    renderApp('/household')

    const share = within(await screen.findByRole('region', { name: /Wer hat’s gemacht/ }))
    expect(share.getByText('letzte 30 Tage')).toBeVisible()
    // Reihenfolge wie in der Familie; Kinder stehen dabei, wenn sie mitgeholfen haben.
    expect(share.getAllByText(/-mal\)$/).map((item) => item.textContent)).toEqual([
      'Lena: 25 % (1-mal)',
      'Mama: 75 % (3-mal)',
    ])
  })

  it('zeigt keine Verteilung, solange niemand „Wer war’s?“ angetippt hat', async () => {
    mockChores()
    renderApp('/household')

    await screen.findByRole('button', { name: /Toilette putzen/ })
    expect(screen.queryByRole('region', { name: /Wer hat’s gemacht/ })).toBeNull()
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
    mockChores(makeChorePlan())
    renderApp('/household')

    const link = await screen.findByRole('link', { name: /Noch kein Putzplan/ })
    expect(link).toHaveAttribute('href', '/parents/household')
    expect(screen.queryByRole('button', { name: 'Nach Raum' })).toBeNull()
  })
})

describe('Zu erledigen', () => {
  const feed = makeTodo({ id: 7 })
  const bulb = makeTodo({
    id: 8,
    title: 'Glühbirne wechseln',
    icon: 'fluent-emoji-flat:light-bulb',
    done: true,
    done_by: 3,
  })

  /** Merkt sich wie der Server, was auf der Liste steht. */
  function mockTodos(initial: Todo[] = [feed, bulb], plan: ChorePlan = PLAN) {
    let todos = initial
    const replace = (todo: Todo) => {
      todos = todos.map((item) => (item.id === todo.id ? todo : item))
      return Response.json(todo)
    }
    return mockApi({
      'GET /api/setup/status': setupDone,
      'GET /api/auth/me': Response.json(makeMe()),
      'GET /api/members': Response.json([lena, mama]),
      'GET /api/chores': () => Response.json({ ...plan, todos }),
      'POST /api/todos': (body) => {
        const todo = makeTodo({ id: 9, ...(body as { title: string; icon: string }) })
        todos = [...todos, todo]
        return Response.json(todo, { status: 201 })
      },
      'PUT /api/todos/7/done': (body) =>
        replace({
          ...feed,
          done: true,
          done_by: (body as { member_id: number | null }).member_id,
        }),
      'DELETE /api/todos/8/done': () => replace({ ...bulb, done: false, done_by: null }),
      'PUT /api/todos/7': (body) => {
        const { title, icon } = body as { title: string; icon: string }
        if (title === bulb.title) return Response.json({ code: 'todo.duplicate' }, { status: 409 })
        return replace({ ...feed, title, icon })
      },
      'DELETE /api/todos/7': () => {
        todos = todos.filter((todo) => todo.id !== 7)
        return new Response(null, { status: 204 })
      },
    })
  }

  const list = async () => within(await screen.findByRole('region', { name: 'Zu erledigen' }))

  it('steht über dem Putzplan: Offenes zum Abhaken, heute Erledigtes durchgestrichen', async () => {
    mockTodos()
    renderApp('/household')

    const todos = await list()
    expect(todos.getByRole('button', { name: 'Hühnerfutter holen' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(todos.getByRole('button', { name: /Glühbirne wechseln/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(todos.getByRole('img', { name: 'Erledigt von Mama' })).toBeVisible()
    // Der Putzplan steht weiter darunter.
    expect(screen.getByRole('region', { name: 'Jetzt dran' })).toBeVisible()
  })

  it('lädt ohne Einträge zum Eintragen ein, auch ohne Putzplan', async () => {
    mockTodos([], makeChorePlan())
    renderApp('/household')

    expect(await (await list()).findByText(/Gerade steht nichts an/)).toBeVisible()
    expect(screen.getByText('Noch kein Putzplan')).toBeVisible()
  })

  it('trägt ohne Eltern-PIN etwas ein, das Symbol folgt dem Text', async () => {
    const user = userEvent.setup()
    const calls = mockTodos([])
    renderApp('/household')

    const todos = await list()
    const add = todos.getByRole('button', { name: 'Eintragen' })
    expect(add).toBeDisabled()
    await user.type(todos.getByRole('textbox', { name: 'Neuer Eintrag' }), 'Paket wegbringen')
    await user.click(add)

    expect(await todos.findByRole('button', { name: 'Paket wegbringen' })).toBeVisible()
    expect(bodiesOf(calls, 'POST /api/todos')).toEqual([
      { title: 'Paket wegbringen', icon: 'fluent-emoji-flat:package' },
    ])
    expect(todos.getByRole('textbox', { name: 'Neuer Eintrag' })).toHaveValue('')
  })

  it('hakt per Tipp ab und fragt danach, wer es war', async () => {
    const user = userEvent.setup()
    const calls = mockTodos()
    renderApp('/household')

    const todos = await list()
    await user.click(todos.getByRole('button', { name: 'Hühnerfutter holen' }))

    const who = within(await screen.findByRole('region', { name: 'Wer war’s?' }))
    expect(who.getByRole('status')).toHaveTextContent('„Hühnerfutter holen“ ist erledigt.')
    await user.click(who.getByRole('button', { name: 'Lena' }))

    expect(bodiesOf(calls, 'PUT /api/todos/7/done')).toEqual([
      { member_id: null },
      { member_id: 1 },
    ])
    expect(await todos.findByRole('img', { name: 'Erledigt von Lena' })).toBeVisible()
    expect(screen.queryByRole('region', { name: 'Wer war’s?' })).toBeNull()
  })

  it('ändert einen offenen Eintrag über den Stift; Abgehaktes hat keinen', async () => {
    const user = userEvent.setup()
    const calls = mockTodos()
    renderApp('/household')

    const todos = await list()
    expect(todos.queryByRole('button', { name: '„Glühbirne wechseln“ ändern' })).toBeNull()
    await user.click(todos.getByRole('button', { name: '„Hühnerfutter holen“ ändern' }))
    const form = within(todos.getByRole('form', { name: 'Eintrag ändern' }))
    const field = form.getByRole('textbox', { name: 'Eintrag ändern' })
    expect(field).toHaveValue('Hühnerfutter holen')

    // Was schon auf der Liste steht, lehnt der Server ab; der Eintrag bleibt zum Ändern offen.
    await user.clear(field)
    await user.type(field, 'Glühbirne wechseln')
    await user.click(form.getByRole('button', { name: 'Speichern' }))
    expect(await todos.findByText('Das steht schon auf der Liste.')).toBeVisible()

    await user.clear(field)
    await user.type(field, 'Hühnerfutter kaufen')
    await user.click(form.getByRole('button', { name: 'Speichern' }))

    expect(await todos.findByRole('button', { name: 'Hühnerfutter kaufen' })).toBeVisible()
    expect(bodiesOf(calls, 'PUT /api/todos/7').at(-1)).toEqual({
      title: 'Hühnerfutter kaufen',
      icon: feed.icon,
    })
    expect(todos.queryByRole('form', { name: 'Eintrag ändern' })).toBeNull()
  })

  it('bricht das Ändern ab, ohne zu speichern', async () => {
    const user = userEvent.setup()
    const calls = mockTodos()
    renderApp('/household')

    const todos = await list()
    await user.click(todos.getByRole('button', { name: '„Hühnerfutter holen“ ändern' }))
    await user.type(todos.getByRole('textbox', { name: 'Eintrag ändern' }), ' sofort')
    await user.click(todos.getByRole('button', { name: 'Abbrechen' }))

    expect(todos.getByRole('button', { name: 'Hühnerfutter holen' })).toBeVisible()
    expect(bodiesOf(calls, 'PUT /api/todos/7')).toEqual([])
  })

  it('nimmt Abgehaktes mit einem weiteren Tipp zurück', async () => {
    const user = userEvent.setup()
    const calls = mockTodos()
    renderApp('/household')

    const todos = await list()
    await user.click(todos.getByRole('button', { name: /Glühbirne wechseln/ }))

    expect(calls.map((call) => call.key)).toContain('DELETE /api/todos/8/done')
    await waitFor(() =>
      expect(todos.getByRole('button', { name: 'Glühbirne wechseln' })).toHaveAttribute(
        'aria-pressed',
        'false',
      ),
    )
  })

  it('streicht Offenes und führt mit „kommt wieder“ in den Putzplan', async () => {
    const user = userEvent.setup()
    const calls = mockTodos()
    renderApp('/household')

    const todos = await list()
    expect(
      todos.getByRole('link', {
        name: '„Hühnerfutter holen“ kommt wieder: in den Putzplan übernehmen',
      }),
    ).toHaveAttribute('href', '/parents/household?todo=7')
    // Abgehaktes lässt sich nicht mehr streichen, nur zurücknehmen.
    expect(todos.queryByRole('button', { name: '„Glühbirne wechseln“ streichen' })).toBeNull()

    await user.click(todos.getByRole('button', { name: '„Hühnerfutter holen“ streichen' }))

    expect(calls.map((call) => call.key)).toContain('DELETE /api/todos/7')
    await waitFor(() =>
      expect(todos.queryByRole('button', { name: 'Hühnerfutter holen' })).toBeNull(),
    )
  })
})
