import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Member } from '../../api/members'
import type { Task } from '../../api/tasks'
import i18n from '../../i18n'
import { makeMe, makeMember, mockApi, renderApp, setupDone } from '../../test/utils'

const lena = makeMember()
const tom = makeMember({ id: 2, name: 'Tom', color: 'green' })
const mama = makeMember({ id: 3, name: 'Mama', role: 'parent', color: 'blue' })

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
    needs_approval: false,
    shared: false,
    extra: false,
    recurrence: { kind: 'daily' },
    member_ids: [1],
    positions: [{ member_id: 1, position: 0 }],
    ...overrides,
  }
}

function api(
  tasks: Task[],
  extra: Record<string, Response | ((body: unknown) => Response)> = {},
  members: Member[] = [lena, tom, mama],
) {
  return mockApi({
    'GET /api/setup/status': setupDone,
    'GET /api/auth/me': Response.json(makeMe({ parent_unlocked: true })),
    'GET /api/members': Response.json(members),
    'GET /api/tasks': Response.json(tasks),
    ...extra,
  })
}

async function routines() {
  return within(await screen.findByRole('region', { name: 'Routinen' }))
}

const stepTitles = (block: HTMLElement) =>
  within(block)
    .queryAllByRole('button', { name: /bearbeiten$/ })
    .map((button) => button.getAttribute('aria-label')?.replace(' bearbeiten', ''))

beforeEach(async () => {
  await i18n.changeLanguage('de')
  // Montag, 28. September 2026, vormittags in Berlin.
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-09-28T08:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('Routinen im Elternbereich', () => {
  it('bittet zuerst um ein Kind', async () => {
    api([], {}, [mama])
    renderApp('/parents/routines')

    expect((await routines()).getByText(/Legt zuerst ein Kind an/)).toBeVisible()
  })

  it('zeigt das gewählte Kind auch, wenn es nur eines gibt', async () => {
    api([makeTask()], {}, [lena, mama])
    renderApp('/parents/routines')

    const children = (await routines()).getByRole('group', { name: 'Kind wählen' })
    expect(within(children).getByRole('button', { name: /Lena/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('zeigt je Kind die Tagesabschnitte als nummerierte Blöcke', async () => {
    const user = userEvent.setup()
    api([
      makeTask({ id: 1, title: 'Zähne putzen', points: 2 }),
      makeTask({ id: 2, title: 'Anziehen', points: 3, positions: [{ member_id: 1, position: 1 }] }),
      makeTask({ id: 3, title: 'Schlafanzug an', time_of_day: 'evening', member_ids: [1, 2] }),
      makeTask({ id: 4, title: 'Tisch abräumen', time_of_day: null, extra: true }),
      makeTask({ id: 5, title: 'Kochen', member_ids: [3] }),
    ])
    renderApp('/parents/routines')

    const section = await routines()
    await section.findByRole('button', { name: 'Anziehen bearbeiten' })
    // Nur Kinder stehen zur Wahl.
    const children = section.getByRole('group', { name: 'Kind wählen' })
    expect(within(children).getAllByRole('button')).toHaveLength(2)
    expect(within(children).queryByRole('button', { name: /Mama/ })).toBeNull()
    // Mittags erscheint nur, wenn dort etwas steht; Extras gehören nicht in die Routinen.
    expect(section.getAllByRole('region').map((block) => block.getAttribute('aria-label'))).toEqual(
      ['Morgens', 'Nachmittags', 'Abends'],
    )
    const morning = section.getByRole('region', { name: 'Morgens' })
    expect(stepTitles(morning)).toEqual(['Zähne putzen', 'Anziehen'])
    expect(within(morning).getByText('2 Schritte')).toBeVisible()
    expect(within(morning).getByText('5 Punkte')).toBeInTheDocument()
    expect(
      within(section.getByRole('region', { name: 'Nachmittags' })).getByText(
        'An diesem Tag noch keine Schritte.',
      ),
    ).toBeVisible()
    expect(section.queryByText('Tisch abräumen')).toBeNull()

    await user.click(within(children).getByRole('button', { name: /Tom/ }))
    expect(stepTitles(section.getByRole('region', { name: 'Morgens' }))).toEqual([])
    expect(stepTitles(section.getByRole('region', { name: 'Abends' }))).toEqual(['Schlafanzug an'])
  })

  it('zeigt die Routine eines gewählten Wochentags', async () => {
    const user = userEvent.setup()
    api([
      makeTask({ id: 1, title: 'Zähne putzen' }),
      makeTask({
        id: 2,
        title: 'Brotdose packen',
        recurrence: { kind: 'weekly', weekdays: [1, 2, 3, 4, 5] },
        positions: [{ member_id: 1, position: 1 }],
      }),
      makeTask({
        id: 3,
        title: 'Pfannkuchen',
        recurrence: { kind: 'once', date: '2026-10-03' },
        positions: [{ member_id: 1, position: 2 }],
      }),
    ])
    renderApp('/parents/routines')

    const section = await routines()
    const days = section.getByRole('group', { name: 'Tag wählen' })
    expect(within(days).getByRole('button', { name: 'Montag, heute' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    const morning = () => section.getByRole('region', { name: 'Morgens' })
    await within(morning()).findByText('Brotdose packen')
    expect(stepTitles(morning())).toEqual(['Zähne putzen', 'Brotdose packen'])
    expect(within(morning()).getByText('Montag bis Freitag')).toBeVisible()

    await user.click(within(days).getByRole('button', { name: 'Samstag' }))
    expect(stepTitles(morning())).toEqual(['Zähne putzen', 'Pfannkuchen'])
  })

  it('sortiert an einem Tag, ohne die Schritte anderer Tage zu verschieben', async () => {
    const user = userEvent.setup()
    const tasks = [
      makeTask({ id: 1, title: 'Zähne putzen' }),
      makeTask({
        id: 2,
        title: 'Brötchen holen',
        recurrence: { kind: 'weekly', weekdays: [6, 7] },
        positions: [{ member_id: 1, position: 1 }],
      }),
      makeTask({ id: 3, title: 'Anziehen', positions: [{ member_id: 1, position: 2 }] }),
      makeTask({
        id: 4,
        title: 'Schlafanzug an',
        time_of_day: 'evening',
        positions: [{ member_id: 1, position: 3 }],
      }),
    ]
    let current = tasks
    const calls = api(tasks, {
      'GET /api/tasks': () => Response.json(current),
      'PUT /api/members/1/task-order': (body) => {
        const ids = (body as { task_ids: number[] }).task_ids
        current = current.map((task) => ({
          ...task,
          positions: [{ member_id: 1, position: ids.indexOf(task.id) }],
        }))
        return new Response(null, { status: 204 })
      },
    })
    renderApp('/parents/routines')

    const section = await routines()
    const morning = section.getByRole('region', { name: 'Morgens' })
    await within(morning).findByText('Anziehen')
    expect(within(morning).getByRole('button', { name: 'Zähne putzen nach oben' })).toBeDisabled()
    await user.click(within(morning).getByRole('button', { name: 'Anziehen nach oben' }))

    expect(calls.find((call) => call.key === 'PUT /api/members/1/task-order')?.body).toEqual({
      task_ids: [3, 2, 1, 4],
    })
    // Sofort in der neuen Reihenfolge.
    expect(stepTitles(morning)).toEqual(['Anziehen', 'Zähne putzen'])
  })

  it('legt einen Schritt mit Kind und Tagesabschnitt vorausgewählt an', async () => {
    const user = userEvent.setup()
    const calls = api([], {
      'POST /api/tasks': (body) =>
        Response.json({ ...makeTask(), ...(body as object), id: 5 }, { status: 201 }),
    })
    renderApp('/parents/routines')

    const section = await routines()
    await user.click(
      within(section.getByRole('region', { name: 'Abends' })).getByRole('button', {
        name: 'Schritt hinzufügen',
      }),
    )
    expect(screen.getByRole('checkbox', { name: /Lena/ })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Abends' })).toBeChecked()

    await user.type(screen.getByLabelText('Titel'), 'Schlafanzug an')
    await user.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(await screen.findByRole('status')).toHaveTextContent('„Schlafanzug an“ ist gespeichert.')
    expect(calls.find((call) => call.key === 'POST /api/tasks')?.body).toMatchObject({
      title: 'Schlafanzug an',
      time_of_day: 'evening',
      extra: false,
      member_ids: [1],
    })
  })
})
