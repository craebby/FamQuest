import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { EventSymbol } from '../../api/calendar'
import i18n from '../../i18n'
import { makeMe, makeMember, makeToday, mockApi, renderApp, setupDone } from '../../test/utils'

beforeEach(async () => {
  await i18n.changeLanguage('de')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const JUDO: EventSymbol = { icon: 'fluent-emoji-flat:martial-arts-uniform', terms: ['Judo'] }

function mockParents(symbols: EventSymbol[], members = [makeMember()]) {
  return mockApi({
    'GET /api/setup/status': setupDone,
    'GET /api/auth/me': Response.json(makeMe({ parent_unlocked: true })),
    'GET /api/members': Response.json(members),
    'GET /api/today': Response.json(makeToday()),
    'GET /api/calendar/symbols': Response.json({ symbols }),
    'PUT /api/calendar/symbols': (body) => Response.json(body),
  })
}

async function symbolSection() {
  const heading = await screen.findByRole('heading', { name: 'Symbole für Termine', level: 2 })
  return within(heading.parentElement!)
}

describe('Symbole für Termine', () => {
  it('zeigt, für wen die Symbole gelten', async () => {
    mockParents([JUDO], [makeMember(), makeMember({ id: 2, name: 'Papa', event_symbols: false })])
    renderApp('/parents/connections')

    const section = await symbolSection()
    expect(await section.findByText('Gilt für:')).toBeVisible()
    expect(section.getByText('Lena')).toBeVisible()
    expect(section.queryByText('Papa')).toBeNull()
    expect(section.getByText('Judo')).toBeVisible()
  })

  it('weist darauf hin, wenn niemand Symbole bekommt', async () => {
    mockParents([], [makeMember({ event_symbols: false })])
    renderApp('/parents/connections')

    const section = await symbolSection()
    expect(await section.findByText(/Noch bei niemandem eingeschaltet/)).toBeVisible()
  })

  it('übernimmt mehrere Vorschläge, vorhandene sind abgehakt', async () => {
    const user = userEvent.setup()
    const calls = mockParents([JUDO])
    renderApp('/parents/connections')

    const section = await symbolSection()
    await user.click(await section.findByRole('button', { name: 'Vorschläge auswählen' }))
    expect(section.getByRole('checkbox', { name: /Judo/ })).toBeDisabled()
    await user.click(section.getByRole('checkbox', { name: /Turnen/ }))
    await user.click(section.getByRole('checkbox', { name: /Reiten/ }))
    await user.click(section.getByRole('button', { name: '2 Symbole übernehmen' }))

    const put = calls.find((call) => call.key === 'PUT /api/calendar/symbols')
    expect(put?.body).toEqual({
      symbols: [
        JUDO,
        {
          icon: 'fluent-emoji-flat:person-cartwheeling',
          terms: ['Turnen', 'Kinderturnen', 'Gymnastik'],
        },
        {
          icon: 'fluent-emoji-flat:horse-racing',
          terms: ['Reiten', 'Reitstunde', 'Voltigieren', 'Pony'],
        },
      ],
    })
    expect(await section.findByText('Turnen')).toBeVisible()
  })

  it('legt ein eigenes Symbol an', async () => {
    const user = userEvent.setup()
    const calls = mockParents([])
    renderApp('/parents/connections')

    const section = await symbolSection()
    await user.click(await section.findByRole('button', { name: 'Eigenes Symbol' }))
    await user.click(section.getByRole('button', { name: 'Speichern' }))
    expect(section.getByText('Bitte ausfüllen')).toBeVisible()

    await user.type(section.getByLabelText('Begriffe'), 'Verabredung,  bei Lena ,')
    await user.click(section.getByRole('button', { name: 'Symbol wählen' }))
    await user.click(await screen.findByRole('button', { name: /^Oma/ }))
    await user.click(section.getByRole('button', { name: 'Speichern' }))

    expect(calls.find((call) => call.key === 'PUT /api/calendar/symbols')?.body).toEqual({
      symbols: [{ icon: 'fluent-emoji-flat:older-person', terms: ['Verabredung', 'bei Lena'] }],
    })
  })

  it('ändert und löscht Einträge', async () => {
    const user = userEvent.setup()
    const calls = mockParents([JUDO, { icon: 'fluent-emoji-flat:tooth', terms: ['Zahnarzt'] }])
    renderApp('/parents/connections')

    const section = await symbolSection()
    await user.click(await section.findByRole('button', { name: '„Judo“ bearbeiten' }))
    const field = section.getByLabelText('Begriffe')
    await user.clear(field)
    await user.type(field, 'Judo, Karate')
    await user.click(section.getByRole('button', { name: 'Speichern' }))
    expect(calls.findLast((call) => call.key === 'PUT /api/calendar/symbols')?.body).toEqual({
      symbols: [
        { ...JUDO, terms: ['Judo', 'Karate'] },
        { icon: 'fluent-emoji-flat:tooth', terms: ['Zahnarzt'] },
      ],
    })

    await user.click(await section.findByRole('button', { name: '„Zahnarzt“ bearbeiten' }))
    await user.click(section.getByRole('button', { name: 'Löschen' }))
    expect(calls.findLast((call) => call.key === 'PUT /api/calendar/symbols')?.body).toEqual({
      symbols: [{ ...JUDO, terms: ['Judo', 'Karate'] }],
    })
  })
})
