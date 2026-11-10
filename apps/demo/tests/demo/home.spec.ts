import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { clearRateLimits, demoAccount } from './helpers.ts'

/**
 * `/` in the public demo (DEMO_MODE): "Try the demo" links there, so it
 * goes to the login page or the panel, never the starter kit's welcome
 * page.
 */
test.group('Demo / home', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => clearRateLimits())

  test('a guest goes to the login page', async ({ client }) => {
    const response = await client.get('/').redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/login')
  })

  for (const role of ['admin', 'editor', 'viewer'] as const) {
    test(`a signed-in ${role} goes to the panel`, async ({ client }) => {
      const user = await demoAccount(role)
      const response = await client.get('/').loginAs(user).redirects(0)

      response.assertStatus(302)
      response.assertHeader('location', '/admin')
    })
  }

  test('an Inertia visit loads the panel, a separate Inertia app', async ({ client }) => {
    const user = await demoAccount('editor')
    const response = await client.get('/').loginAs(user).withInertia().redirects(0)

    response.assertStatus(409)
    response.assertHeader('x-inertia-location', '/admin')
  })
})
