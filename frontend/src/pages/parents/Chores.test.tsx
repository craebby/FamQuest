import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ChorePlan, SetupRoom } from '../../api/chores'
import i18n from '../../i18n'
import {
  makeChore,
  makeMe,
  makeMember,
  makeToday,
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

const PLAN: ChorePlan = {
  date: '2026-10-03',
  rooms: [
    { id: 1, name: 'Bad', icon: 'fluent-emoji-flat:bathtub' },
    { id: 2, name: 'Überall', icon: 'fluent-emoji-flat:broom' },
  ],
  chores: [toilet, windows],
}

const EMPTY: ChorePlan = { date: '2026-10-03', rooms: [], chores: [] }

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
    expect(upstairs.getByRole('checkbox', { name: /Toilette putzen\s*alle 10 Tage/ })).toBeChecked()
    expect(screen.getByRole('region', { name: 'Bad unten' })).toBeVisible()
    const everywhere = within(screen.getByRole('region', { name: 'Überall' }))
    expect(everywhere.getByRole('checkbox', { name: /Saugroboter leeren/ })).toBeChecked()
    expect(everywhere.queryByRole('checkbox', { name: /^Staubsaugen/ })).toBeNull()

    // Abwählen, was nicht passt.
    await user.click(upstairs.getByRole('checkbox', { name: /Abflüsse reinigen/ }))
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
      'Wäsche',
      'Garten',
      'Rund ums Haus',
      'Papierkram und Technik',
    ])
    const titles = (name: string) =>
      rooms.find((sent) => sent.name === name)?.chores.map((chore) => chore.title)
    expect(titles('Bad oben')).not.toContain('Abflüsse reinigen')
    expect(titles('Bad unten')).toContain('Abflüsse reinigen')
    expect(rooms[1].chores[0]).toEqual({
      title: 'Toilette putzen',
      icon: 'fluent-emoji-flat:toilet',
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

    const bath = within(screen.getByRole('region', { name: 'Bad' }))
    const present = bath.getByRole('checkbox', { name: /Toilette putzen/ })
    expect(present).toBeDisabled()
    expect(present).toBeChecked()
    await user.click(screen.getByRole('button', { name: /Aufgaben übernehmen/ }))

    const sent = sentRooms(calls).find((candidate) => candidate.name === 'Bad')
    expect(sent?.chores.map((chore) => chore.title)).not.toContain('Toilette putzen')
    expect(sent?.chores.map((chore) => chore.title)).toContain('Boden wischen')
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
