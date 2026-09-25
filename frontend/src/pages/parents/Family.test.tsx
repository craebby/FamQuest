import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import i18n from '../../i18n'
import { makeMe, makeToday, mockApi, renderApp, setupDone } from '../../test/utils'

beforeEach(async () => {
  await i18n.changeLanguage('de')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Einstellungen der Familie', () => {
  it('ändert Name, Sprache und Zeitzone', async () => {
    const user = userEvent.setup()
    const me = makeMe({ parent_unlocked: true })
    const calls = mockApi({
      'GET /api/setup/status': setupDone,
      'GET /api/auth/me': Response.json(me),
      'GET /api/members': Response.json([]),
      'GET /api/tasks': Response.json([]),
      'GET /api/rewards': Response.json([]),
      'GET /api/approvals': Response.json([]),
      'GET /api/today': Response.json(makeToday()),
      'PUT /api/parent/family': (body) =>
        Response.json({
          ...me,
          family: { ...me.family, ...(body as object), name: 'Familie Mond' },
        }),
    })
    renderApp('/parents')

    const section = within(
      (await screen.findByRole('heading', { name: 'Familie', level: 2 })).parentElement!,
    )
    const save = section.getByRole('button', { name: 'Speichern' })
    expect(save).toBeDisabled()

    await user.clear(section.getByLabelText('Familienname'))
    await user.type(section.getByLabelText('Familienname'), 'Familie Mond')
    await user.click(section.getByRole('button', { name: 'English' }))
    await user.selectOptions(section.getByLabelText('Zeitzone'), 'Europe/London')
    await user.click(save)

    expect(await screen.findByRole('status')).toBeVisible()
    expect(calls.find((call) => call.key === 'PUT /api/parent/family')?.body).toEqual({
      name: 'Familie Mond',
      default_language: 'en',
      timezone: 'Europe/London',
    })
  })
})
