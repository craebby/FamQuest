import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Task } from '../../api/tasks'
import i18n from '../../i18n'
import { makeMe, makeMember, mockApi, renderApp, setupDone } from '../../test/utils'

const lena = makeMember()
const tom = makeMember({ id: 2, name: 'Tom', color: 'green' })

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    title: 'Zähne putzen',
    icon: 'fluent-emoji-flat:toothbrush',
    description: '',
    points: 2,
    time_of_day: 'morning',
    color: null,
    active: true,
    recurrence: { kind: 'daily' },
    member_ids: [1],
    ...overrides,
  }
}

function api(tasks: Task[], extra: Record<string, Response | ((body: unknown) => Response)> = {}) {
  return mockApi({
    'GET /api/setup/status': setupDone,
    'GET /api/auth/me': Response.json(makeMe({ parent_unlocked: true })),
    'GET /api/members': Response.json([lena, tom]),
    'GET /api/tasks': Response.json(tasks),
    ...extra,
  })
}

beforeEach(async () => {
  await i18n.changeLanguage('de')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Aufgaben im Elternbereich', () => {
  it('bittet zuerst um Familienmitglieder', async () => {
    mockApi({
      'GET /api/setup/status': setupDone,
      'GET /api/auth/me': Response.json(makeMe({ parent_unlocked: true })),
      'GET /api/members': Response.json([]),
      'GET /api/tasks': Response.json([]),
    })
    renderApp('/parents')

    expect(await screen.findByText(/Legt zuerst Familienmitglieder an/)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Aufgabe hinzufügen' })).not.toBeInTheDocument()
  })

  it('listet Aufgaben nach Tageszeit und filtert nach Person', async () => {
    const user = userEvent.setup()
    api([
      makeTask({ id: 1, title: 'Schlafanzug an', time_of_day: 'evening', member_ids: [1, 2] }),
      makeTask({
        id: 2,
        title: 'Bett machen',
        icon: 'fluent-emoji-flat:bed',
        points: 1,
        recurrence: { kind: 'weekly', weekdays: [1, 2, 3, 4, 5] },
        member_ids: [2],
      }),
      makeTask({ id: 3, title: 'Müll', time_of_day: null, member_ids: [], active: false }),
    ])
    renderApp('/parents')

    await screen.findByRole('button', { name: 'Bett machen bearbeiten' })
    const taskTitles = screen
      .getAllByRole('button', { name: /bearbeiten$/ })
      .map((button) => button.getAttribute('aria-label'))
      .filter((label) => !['Lena bearbeiten', 'Tom bearbeiten'].includes(label ?? ''))
    // Morgens vor abends, Aufgaben ohne Tageszeit zuletzt.
    expect(taskTitles).toEqual([
      'Bett machen bearbeiten',
      'Schlafanzug an bearbeiten',
      'Müll bearbeiten',
    ])
    const bed = screen.getByRole('button', { name: 'Bett machen bearbeiten' })
    expect(within(bed).getByText('Montag bis Freitag')).toBeVisible()
    expect(within(bed).getByText('1 Punkt')).toBeInTheDocument()
    const trash = screen.getByRole('button', { name: 'Müll bearbeiten' })
    expect(within(trash).getByText('Niemand zugeordnet')).toBeVisible()
    expect(within(trash).getByText('Inaktiv')).toBeVisible()

    const filter = screen.getByRole('group', { name: 'Nach Person filtern' })
    await user.click(within(filter).getByRole('button', { name: /Lena/ }))

    expect(screen.getByRole('button', { name: 'Schlafanzug an bearbeiten' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Bett machen bearbeiten' })).toBeNull()
  })

  it('legt eine Aufgabe an und schlägt das Symbol passend zum Titel vor', async () => {
    const user = userEvent.setup()
    const calls = api([], {
      'POST /api/tasks': (body) =>
        Response.json({ ...makeTask(), ...(body as object), id: 5 }, { status: 201 }),
    })
    renderApp('/parents')

    await user.click(await screen.findByRole('button', { name: 'Aufgabe hinzufügen' }))
    await user.type(screen.getByLabelText('Titel'), 'Zähne putzen')
    expect(screen.getByRole('button', { name: 'Symbol ändern: Zähne putzen' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Mehr Punkte' }))
    await user.click(screen.getByRole('checkbox', { name: /Lena/ }))
    await user.click(screen.getByRole('radio', { name: 'An bestimmten Tagen' }))
    await user.click(screen.getByRole('button', { name: 'Wochenende' }))
    await user.click(screen.getByRole('checkbox', { name: 'Montag' }))
    await user.click(screen.getByRole('radio', { name: 'Abends' }))
    await user.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(await screen.findByRole('status')).toHaveTextContent('„Zähne putzen“ ist gespeichert.')
    expect(calls.find((call) => call.key === 'POST /api/tasks')?.body).toEqual({
      title: 'Zähne putzen',
      icon: 'fluent-emoji-flat:toothbrush',
      description: '',
      points: 2,
      time_of_day: 'evening',
      color: null,
      active: true,
      recurrence: { kind: 'weekly', weekdays: [1, 6, 7] },
      member_ids: [1],
    })
  })

  it('verlangt Titel und mindestens eine Person', async () => {
    const user = userEvent.setup()
    const calls = api([])
    renderApp('/parents')

    await user.click(await screen.findByRole('button', { name: 'Aufgabe hinzufügen' }))
    await user.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(screen.getByText('Bitte ausfüllen')).toBeVisible()
    expect(screen.getByText('Bitte mindestens eine Person wählen')).toBeVisible()
    expect(calls.some((call) => call.key === 'POST /api/tasks')).toBe(false)
  })

  it('übernimmt die gefilterte Person als Vorauswahl', async () => {
    const user = userEvent.setup()
    api([makeTask()])
    renderApp('/parents')

    const filter = await screen.findByRole('group', { name: 'Nach Person filtern' })
    await user.click(within(filter).getByRole('button', { name: /Tom/ }))
    await user.click(screen.getByRole('button', { name: 'Aufgabe hinzufügen' }))

    expect(screen.getByRole('checkbox', { name: /Tom/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Lena/ })).not.toBeChecked()
  })

  it('findet Symbole auf Deutsch und Englisch', async () => {
    const user = userEvent.setup()
    api([makeTask()], {
      'PUT /api/tasks/1': (body) => Response.json({ ...makeTask(), ...(body as object) }),
    })
    renderApp('/parents')

    await user.click(await screen.findByRole('button', { name: 'Zähne putzen bearbeiten' }))
    await user.click(screen.getByRole('button', { name: 'Symbol ändern: Zähne putzen' }))
    const picker = screen.getByRole('dialog', { name: 'Symbol wählen' })
    expect(within(picker).getByRole('button', { name: 'Zähne putzen' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    const search = within(picker).getByRole('searchbox', { name: 'Symbol suchen' })
    await user.type(search, 'dog')
    expect(within(picker).getByRole('button', { name: 'Hund füttern' })).toBeVisible()
    await user.clear(search)
    await user.type(search, 'Hund')
    await user.click(within(picker).getByRole('button', { name: 'Hund füttern' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('button', { name: 'Symbol ändern: Hund füttern' })).toBeVisible()
  })

  it('zeigt einen Hinweis, wenn die Suche nichts findet', async () => {
    const user = userEvent.setup()
    api([makeTask()])
    renderApp('/parents')

    await user.click(await screen.findByRole('button', { name: 'Aufgabe hinzufügen' }))
    await user.click(screen.getByRole('button', { name: /^Symbol ändern/ }))
    await user.type(screen.getByRole('searchbox'), 'qqq')

    expect(screen.getByText(/Kein Symbol gefunden/)).toBeVisible()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('schaltet eine Aufgabe direkt in der Liste inaktiv', async () => {
    const user = userEvent.setup()
    const calls = api([makeTask()], {
      'PUT /api/tasks/1': (body) => Response.json({ ...makeTask(), ...(body as object) }),
    })
    renderApp('/parents')

    await user.click(await screen.findByRole('switch', { name: 'Zähne putzen aktiv' }))

    const update = calls.find((call) => call.key === 'PUT /api/tasks/1')
    expect(update?.body).toMatchObject({ active: false, title: 'Zähne putzen', member_ids: [1] })
    expect(update?.body).not.toHaveProperty('id')
  })

  it('bearbeitet eine einmalige Aufgabe und löscht sie', async () => {
    const user = userEvent.setup()
    const calls = api(
      [makeTask({ recurrence: { kind: 'once', date: '2026-10-03' }, color: 'teal' })],
      { 'DELETE /api/tasks/1': new Response(null, { status: 204 }) },
    )
    renderApp('/parents')

    await user.click(await screen.findByRole('button', { name: 'Zähne putzen bearbeiten' }))
    expect(screen.getByRole('radio', { name: 'Einmal' })).toBeChecked()
    expect(screen.getByLabelText('Datum')).toHaveValue('2026-10-03')
    expect(screen.getByRole('radio', { name: 'Türkis' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Lena/ })).toBeChecked()

    await user.click(screen.getByRole('button', { name: 'Aufgabe löschen' }))
    await user.click(screen.getByRole('button', { name: 'Aufgabe löschen' }))

    expect(await screen.findByRole('status')).toHaveTextContent('„Zähne putzen“ ist gelöscht.')
    expect(calls.some((call) => call.key === 'DELETE /api/tasks/1')).toBe(true)
  })

  it('funktioniert auch auf Englisch', async () => {
    await i18n.changeLanguage('en')
    mockApi({
      'GET /api/setup/status': setupDone,
      'GET /api/auth/me': Response.json(
        makeMe({ parent_unlocked: true, family: { ...makeMe().family, default_language: 'en' } }),
      ),
      'GET /api/members': Response.json([lena, tom]),
      'GET /api/tasks': Response.json([
        makeTask({ recurrence: { kind: 'weekly', weekdays: [6, 7] } }),
      ]),
    })
    renderApp('/parents')

    const row = await screen.findByRole('button', { name: 'Edit Zähne putzen' })
    expect(within(row).getByText('At the weekend')).toBeVisible()
    expect(within(row).getByText('Morning')).toBeVisible()
  })
})
