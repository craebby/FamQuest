import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ChorePlan, SetupRoom } from '../../api/chores'
import i18n from '../../i18n'
import {
  makeChore,
  makeChorePlan,
  makeMe,
  makeMember,
  makeToday,
  makeTodo,
  mockApi,
  renderApp,
  setupDone,
} from '../../test/utils'

const lena = makeMember({ id: 1, name: 'Lena', color: 'purple' })
const mama = makeMember({ id: 3, name: 'Mama', role: 'parent', color: 'blue' })

const toilet = makeChore({ id: 1, room_id: 1, title: 'Toilette putzen', interval_days: 7 })
const windows = makeChore({
  id: 2,
  room_id: 2,
  title: 'Fenster putzen',
  icon: 'fluent-emoji-flat:window',
  interval_days: 180,
  active: false,
})

const PLAN = makeChorePlan({
  rooms: [
    { id: 1, name: 'Bad', icon: 'fluent-emoji-flat:bathtub' },
    { id: 2, name: 'Überall', icon: 'fluent-emoji-flat:broom' },
  ],
  chores: [toilet, windows],
})

const EMPTY = makeChorePlan()

function api(plan: ChorePlan = PLAN, members = [lena, mama]) {
  return mockApi({
    'GET /api/setup/status': setupDone,
    'GET /api/auth/me': Response.json(makeMe({ parent_unlocked: true })),
    'GET /api/members': Response.json(members),
    'GET /api/tasks': Response.json([]),
    'GET /api/routines': Response.json([]),
    'GET /api/rewards': Response.json([]),
    'GET /api/today': Response.json(makeToday()),
    'GET /api/chores': Response.json(plan),
    'POST /api/chores': (body) => Response.json({ ...toilet, id: 9, ...(body as object) }),
    'PUT /api/chores/1': (body) => Response.json({ ...toilet, ...(body as object) }),
    'PUT /api/chores/2': (body) => Response.json({ ...windows, ...(body as object) }),
    'DELETE /api/chores/1': new Response(null, { status: 204 }),
    'POST /api/chores/rooms': (body) =>
      Response.json({ id: 9, ...(body as object) }, { status: 201 }),
    'PUT /api/chores/rooms/1': (body) => Response.json({ id: 1, ...(body as object) }),
    'DELETE /api/chores/rooms/1': new Response(null, { status: 204 }),
    'POST /api/chores/setup': (body) => {
      const rooms = (body as { rooms: SetupRoom[] }).rooms
      const chores = rooms.reduce((sum, room) => sum + room.chores.length, 0)
      return Response.json({ rooms: rooms.length, chores }, { status: 201 })
    },
  })
}

const bodyOf = (calls: ReturnType<typeof mockApi>, key: string) =>
  calls.find((call) => call.key === key)?.body

async function room(name: string) {
  return within((await screen.findByRole('heading', { name, level: 2 })).parentElement!)
}

beforeEach(async () => {
  await i18n.changeLanguage('de')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Putzplan im Elternbereich', () => {
  it('ist ein eigener Bereich und zeigt Räume mit Aufgaben und Abständen', async () => {
    api()
    renderApp('/parents/household')

    expect(await screen.findByRole('heading', { name: 'Putzplan', level: 2 })).toBeVisible()
    const bath = await room('Bad')
    const edit = await bath.findByRole('button', { name: 'Toilette putzen bearbeiten' })
    expect(edit).toHaveTextContent('jede Woche')
    expect(edit).toHaveTextContent('In 7 Tagen')
    expect(
      (await room('Überall')).getByRole('button', { name: 'Fenster putzen bearbeiten' }),
    ).toHaveTextContent('Pausiert')
  })

  it('pausiert eine Aufgabe über den Schalter', async () => {
    const user = userEvent.setup()
    const calls = api()
    renderApp('/parents/household')

    await user.click(await screen.findByRole('switch', { name: 'Toilette putzen aktiv' }))

    expect(bodyOf(calls, 'PUT /api/chores/1')).toEqual({
      room_id: 1,
      title: 'Toilette putzen',
      icon: 'fluent-emoji-flat:toilet',
      interval_days: 7,
      active: false,
    })
  })

  it('legt einen Raum an, Symbol automatisch', async () => {
    const user = userEvent.setup()
    const calls = api()
    renderApp('/parents/household')

    await user.click(await screen.findByRole('button', { name: 'Raum anlegen' }))
    await user.type(screen.getByRole('textbox', { name: 'Name des Raums' }), 'Garten')
    await user.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(await screen.findByText('„Garten“ ist gespeichert.')).toBeVisible()
    expect(bodyOf(calls, 'POST /api/chores/rooms')).toMatchObject({ name: 'Garten' })
  })

  it('warnt beim Löschen eines Raums, dass seine Aufgaben mitgehen', async () => {
    const user = userEvent.setup()
    const calls = api()
    renderApp('/parents/household')

    await user.click(await screen.findByRole('button', { name: 'Raum „Bad“ bearbeiten' }))
    await user.click(screen.getByRole('button', { name: 'Raum löschen' }))
    expect(
      screen.getByText('„Bad“ wirklich löschen? Die Aufgabe darin wird mitgelöscht.'),
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Raum löschen' }))

    expect(await screen.findByText('„Bad“ ist gelöscht.')).toBeVisible()
    expect(calls.map((call) => call.key)).toContain('DELETE /api/chores/rooms/1')
  })

  it('legt eine Aufgabe mit eigenem Abstand und Stand an', async () => {
    const user = userEvent.setup()
    const calls = api()
    renderApp('/parents/household')

    await user.click((await room('Bad')).getByRole('button', { name: 'Aufgabe hinzufügen' }))
    expect(screen.getByRole('heading', { name: 'Neue Hausarbeit', level: 1 })).toBeVisible()
    await user.type(screen.getByRole('textbox', { name: 'Was ist zu tun?' }), 'Dusche putzen')
    // Vorgabe: alle 2 Wochen. Daraus werden 3 Monate.
    await user.click(screen.getByRole('button', { name: 'Mehr' }))
    await user.click(screen.getByRole('button', { name: 'Monate' }))
    expect(screen.getByText(/Dran alle 3 Monate/)).toBeVisible()
    await user.click(screen.getByRole('radio', { name: 'Jetzt fällig' }))
    await user.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(await screen.findByText('„Dusche putzen“ ist gespeichert.')).toBeVisible()
    expect(bodyOf(calls, 'POST /api/chores')).toEqual({
      room_id: 1,
      title: 'Dusche putzen',
      icon: 'fluent-emoji-flat:shower',
      interval_days: 90,
      active: true,
      state: 'due',
    })
  })

  it('ändert Raum und Abstand einer Aufgabe, ohne nach dem Stand zu fragen', async () => {
    const user = userEvent.setup()
    const calls = api()
    renderApp('/parents/household')

    await user.click(await screen.findByRole('button', { name: 'Toilette putzen bearbeiten' }))
    expect(screen.getByRole('button', { name: 'Woche' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('radio', { name: 'Jetzt fällig' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Überall' }))
    await user.click(screen.getByRole('button', { name: 'Tag' }))
    await user.click(screen.getByRole('button', { name: 'Mehr' }))
    await user.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(bodyOf(calls, 'PUT /api/chores/1')).toEqual({
      room_id: 2,
      title: 'Toilette putzen',
      icon: 'fluent-emoji-flat:toilet',
      interval_days: 2,
      active: true,
    })
  })

  it('legt eine Aufgabe an, die zuletzt vor zehn Wochen erledigt wurde', async () => {
    const user = userEvent.setup()
    const calls = api()
    renderApp('/parents/household')

    await user.click((await room('Überall')).getByRole('button', { name: 'Aufgabe hinzufügen' }))
    await user.type(screen.getByRole('textbox', { name: 'Was ist zu tun?' }), 'Fenster putzen')
    await user.click(screen.getByRole('button', { name: 'Monate' }))
    for (let count = 2; count < 6; count++) {
      await user.click(screen.getByRole('button', { name: 'Mehr' }))
    }
    expect(screen.queryByLabelText('Zuletzt erledigt')).toBeNull()
    await user.click(screen.getByRole('radio', { name: 'Datum wählen' }))

    // Ohne Datum geht es nicht weiter.
    await user.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(screen.getByText('Bitte ausfüllen')).toBeVisible()
    expect(calls.map((call) => call.key)).not.toContain('POST /api/chores')

    fireEvent.change(screen.getByLabelText('Zuletzt erledigt'), {
      target: { value: '2026-07-25' },
    })
    expect(screen.getByText('Wieder fällig am 21.01.2027.')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(await screen.findByText('„Fenster putzen“ ist gespeichert.')).toBeVisible()
    expect(bodyOf(calls, 'POST /api/chores')).toMatchObject({
      title: 'Fenster putzen',
      interval_days: 180,
      counted_from: '2026-07-25',
    })
    expect(bodyOf(calls, 'POST /api/chores')).not.toHaveProperty('state')
  })

  it('legt beim Bearbeiten fest, wann zuletzt erledigt wurde', async () => {
    const user = userEvent.setup()
    const done = makeChore({ ...toilet, last_done: '2026-10-01', counted_from: '2026-10-01' })
    const calls = api({ ...PLAN, chores: [done, windows] })
    renderApp('/parents/household')

    await user.click(await screen.findByRole('button', { name: 'Toilette putzen bearbeiten' }))
    const date = screen.getByLabelText('Zuletzt erledigt')
    expect(date).toHaveValue('2026-10-01')
    expect(date).toHaveAttribute('max', '2026-10-03')
    expect(screen.getByText('Wieder fällig am 08.10.2026.')).toBeVisible()

    // Morgen kann noch nichts erledigt sein.
    fireEvent.change(date, { target: { value: '2026-10-04' } })
    expect(screen.getByText('Dieser Tag liegt in der Zukunft.')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(calls.map((call) => call.key)).not.toContain('PUT /api/chores/1')

    // Vor dem letzten Abhaken: schon wieder fällig, und die spätere Erledigung fällt weg.
    fireEvent.change(date, { target: { value: '2026-09-20' } })
    expect(
      screen.getByText(
        'Damit ist sie jetzt dran (fällig seit 27.09.2026). Später abgehakte Erledigungen werden dabei gelöscht.',
      ),
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(await screen.findByText('„Toilette putzen“ ist gespeichert.')).toBeVisible()
    expect(bodyOf(calls, 'PUT /api/chores/1')).toMatchObject({ counted_from: '2026-09-20' })
  })

  it('macht aus „Zu erledigen“ eine Aufgabe im Putzplan („kommt wieder“)', async () => {
    const user = userEvent.setup()
    const feed = makeTodo({ id: 7 })
    const calls = api({ ...PLAN, todos: [feed] })
    renderApp('/parents/household?todo=7')

    expect(await screen.findByRole('heading', { name: 'Neue Hausarbeit', level: 1 })).toBeVisible()
    expect(screen.getByText(/Kommt wieder: Wählt Raum und Abstand/)).toBeVisible()
    expect(screen.getByRole('textbox', { name: 'Was ist zu tun?' })).toHaveValue(
      'Hühnerfutter holen',
    )
    // Was noch offen auf der Liste steht, ist jetzt dran.
    expect(screen.getByRole('radio', { name: 'Jetzt fällig' })).toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Überall' }))
    await user.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(await screen.findByText('„Hühnerfutter holen“ ist gespeichert.')).toBeVisible()
    expect(bodyOf(calls, 'POST /api/chores')).toEqual({
      room_id: 2,
      title: 'Hühnerfutter holen',
      icon: 'fluent-emoji-flat:chicken',
      interval_days: 14,
      active: true,
      state: 'due',
      todo_id: 7,
    })
    // Zurück in der Übersicht, nicht wieder im Editor.
    expect(screen.getByRole('heading', { name: 'Putzplan', level: 2 })).toBeVisible()
  })

  it('bricht „kommt wieder“ ab, ohne etwas anzulegen', async () => {
    const user = userEvent.setup()
    const calls = api({ ...PLAN, todos: [makeTodo({ id: 7 })] })
    renderApp('/parents/household?todo=7')

    await user.click(await screen.findByRole('button', { name: 'Abbrechen' }))

    expect(await screen.findByRole('heading', { name: 'Putzplan', level: 2 })).toBeVisible()
    expect(calls.map((call) => call.key)).not.toContain('POST /api/chores')
  })

  it('verlangt für „kommt wieder“ zuerst einen Raum', async () => {
    api(makeChorePlan({ todos: [makeTodo({ id: 7 })] }))
    renderApp('/parents/household?todo=7')

    expect(
      await screen.findByText(
        '„Hühnerfutter holen“ kommt wieder? Dafür braucht der Putzplan zuerst einen Raum.',
      ),
    ).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Neue Hausarbeit' })).toBeNull()
  })

  it('löscht eine Aufgabe erst nach Rückfrage', async () => {
    const user = userEvent.setup()
    const calls = api()
    renderApp('/parents/household')

    await user.click(await screen.findByRole('button', { name: 'Toilette putzen bearbeiten' }))
    await user.click(screen.getByRole('button', { name: 'Hausarbeit löschen' }))
    expect(calls.map((call) => call.key)).not.toContain('DELETE /api/chores/1')
    await user.click(screen.getByRole('button', { name: 'Hausarbeit löschen' }))

    expect(await screen.findByText('„Toilette putzen“ ist gelöscht.')).toBeVisible()
  })
})

describe('Einrichtungs-Assistent', () => {
  async function openWizard(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('button', { name: 'Assistent starten' }))
    expect(screen.getByRole('heading', { name: 'Putzplan einrichten', level: 1 })).toBeVisible()
  }

  const sentRooms = (calls: ReturnType<typeof mockApi>) =>
    (bodyOf(calls, 'POST /api/chores/setup') as { rooms: SetupRoom[] }).rooms

  it('lädt ohne Räume zum Assistenten ein', async () => {
    api(EMPTY)
    renderApp('/parents/household')

    expect(await screen.findByText(/Noch gibt es keine Räume/)).toBeVisible()
  })

  it('macht aus den Antworten einen Vorschlag und übernimmt ihn', async () => {
    const user = userEvent.setup()
    const calls = api(EMPTY)
    renderApp('/parents/household')
    await openWizard(user)

    // Mit Kindern in der Familie ist das Kinderzimmer vorgewählt.
    expect(screen.getByRole('switch', { name: 'Kinderzimmer' })).toBeChecked()
    await user.click(screen.getByRole('radio', { name: 'Haus' }))
    await user.click(screen.getByRole('button', { name: 'Ein Bad mehr' }))
    await user.click(screen.getByRole('switch', { name: 'Saugroboter' }))
    await user.click(screen.getByRole('switch', { name: 'Garten' }))
    await user.click(screen.getByRole('radio', { name: /Locker/ }))
    await user.click(screen.getByRole('button', { name: 'Vorschlag ansehen' }))

    expect(screen.getByRole('heading', { name: 'Euer Vorschlag', level: 1 })).toBeVisible()
    const upstairs = within(screen.getByRole('region', { name: 'Bad oben' }))
    // „Locker“ streckt die Abstände: aus jeder Woche werden 10 Tage.
    expect(upstairs.getByRole('checkbox', { name: /Bad putzen\s*alle 10 Tage/ })).toBeChecked()
    // Nur das Mindeste ist angehakt, der Rest steht zum Dazuwählen bereit.
    const towels = upstairs.getByRole('checkbox', { name: /Handtücher wechseln/ })
    expect(towels).not.toBeChecked()
    expect(screen.getByRole('region', { name: 'Bad unten' })).toBeVisible()
    const everywhere = within(screen.getByRole('region', { name: 'Überall' }))
    expect(everywhere.getByRole('checkbox', { name: /Saugroboter leeren/ })).toBeChecked()
    expect(everywhere.queryByRole('checkbox', { name: /^Staubsaugen/ })).toBeNull()

    // Abwählen, was nicht passt, und dazuwählen, was fehlt.
    await user.click(upstairs.getByRole('checkbox', { name: /Abflüsse reinigen/ }))
    await user.click(towels)
    await user.click(screen.getByRole('button', { name: /Aufgaben übernehmen/ }))

    expect(await screen.findByText(/Aufgaben sind im Putzplan\./)).toBeVisible()
    const rooms = sentRooms(calls)
    expect(rooms.map((sent) => sent.name)).toEqual([
      'Küche',
      'Bad oben',
      'Bad unten',
      'Wohnzimmer',
      'Schlafzimmer',
      'Kinderzimmer',
      'Überall',
      'Garten',
      'Rund ums Haus',
      'Papierkram und Technik',
    ])
    const titles = (name: string) =>
      rooms.find((sent) => sent.name === name)?.chores.map((chore) => chore.title)
    expect(titles('Bad oben')).toEqual(['Bad putzen', 'Handtücher wechseln'])
    expect(titles('Bad unten')).toEqual(['Bad putzen', 'Abflüsse reinigen'])
    expect(rooms[1].chores[0]).toEqual({
      title: 'Bad putzen',
      icon: 'fluent-emoji-flat:shower',
      interval_days: 10,
    })
  })

  it('überspringt, was es schon gibt', async () => {
    const user = userEvent.setup()
    const calls = api(PLAN, [mama])
    renderApp('/parents/household')
    await openWizard(user)

    expect(screen.getByRole('switch', { name: 'Kinderzimmer' })).not.toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Vorschlag ansehen' }))

    const everywhere = within(screen.getByRole('region', { name: 'Überall' }))
    const present = everywhere.getByRole('checkbox', { name: /Fenster putzen/ })
    expect(present).toBeDisabled()
    expect(present).toBeChecked()
    await user.click(screen.getByRole('button', { name: /Aufgaben übernehmen/ }))

    const sent = sentRooms(calls).find((candidate) => candidate.name === 'Überall')
    expect(sent?.chores.map((chore) => chore.title)).not.toContain('Fenster putzen')
    expect(sent?.chores.map((chore) => chore.title)).toContain('Staubsaugen')
  })

  it('führt vom Vorschlag zurück zu den Fragen, die Antworten bleiben', async () => {
    const user = userEvent.setup()
    api(EMPTY)
    renderApp('/parents/household')
    await openWizard(user)

    await user.click(screen.getByRole('switch', { name: 'Auto' }))
    await user.click(screen.getByRole('button', { name: 'Vorschlag ansehen' }))
    await user.click(screen.getByRole('button', { name: 'Zurück' }))

    expect(screen.getByRole('switch', { name: 'Auto' })).toBeChecked()
  })
})
