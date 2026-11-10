import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { clearRateLimits, demoAccount } from './helpers.ts'

/**
 * The public demo's one-click sign-in (DEMO_MODE): a POST with CSRF per
 * role, signing in the seeded account.
 */
test.group('Demo / one-click sign-in', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => clearRateLimits())

  test('the login page offers Admin, Editor and Viewer, and the reset banner', async ({
    client,
    assert,
  }) => {
    const response = await client.get('/login').withInertia()

    response.assertStatus(200)
    const { demo } = response.body().props
    assert.deepEqual(demo.roles, ['admin', 'editor', 'viewer'])
    assert.equal(demo.resetEveryMinutes, 60)
    // The suite's setup ran demo:reset, so the time is recorded
    assert.isString(demo.lastResetAt)
  })

  for (const [role, email] of [
    ['admin', 'admin@azu.test'],
    ['editor', 'staff@azu.test'],
    ['viewer', 'viewer@azu.test'],
  ] as const) {
    test(`"Sign in as ${role}" signs in ${email} and opens the panel`, async ({ client }) => {
      const user = await demoAccount(role)
      const response = await client
        .post(`/demo/sign-in/${role}`)
        .withCsrfToken()
        .withInertia()
        .redirects(0)

      // The admin is a separate Inertia app, so a location visit
      response.assertStatus(409)
      response.assertHeader('x-inertia-location', '/admin')
      response.assertSession('auth_web', user.id)
    })
  }

  test('a full page POST redirects to the panel', async ({ client }) => {
    const response = await client.post('/demo/sign-in/viewer').withCsrfToken().redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/admin')
  })

  test('forbidden: without a CSRF token, no one is signed in', async ({ client }) => {
    const response = await client.post('/demo/sign-in/admin').redirects(0)

    response.assertSessionMissing('auth_web')
  })

  test('only the three roles have a route', async ({ client }) => {
    for (const role of ['staff', 'customer', 'root']) {
      const response = await client.post(`/demo/sign-in/${role}`).withCsrfToken().redirects(0)
      response.assertStatus(404)
    }
  })
})
