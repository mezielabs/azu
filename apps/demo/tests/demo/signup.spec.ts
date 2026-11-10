import { test } from '@japa/runner'
import router from '@adonisjs/core/services/router'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import { clearRateLimits } from './helpers.ts'

/**
 * The public demo (DEMO_MODE) has no signup. Its Users resource would
 * otherwise show every visitor's signup email to anyone who signs in.
 */
test.group('Demo / no signup', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => clearRateLimits())

  test('the signup routes do not exist', async ({ client, assert }) => {
    assert.isNull(router.match('/signup', 'GET', false))
    assert.isNull(router.match('/signup', 'POST', false))

    const page = await client.get('/signup')
    page.assertStatus(404)
  })

  test('forbidden: posting a signup creates no user', async ({ client, assert }) => {
    const email = 'visitor@example.com'
    const response = await client
      .post('/signup')
      .withCsrfToken()
      .form({
        fullName: 'A Visitor',
        email,
        password: 'secret123',
        passwordConfirmation: 'secret123',
      })
      .redirects(0)

    response.assertStatus(404)
    response.assertSessionMissing('auth_web')
    assert.isNull(await User.findBy('email', email))
  })

  test('the login and home pages have no signup link', async ({ client, assert }) => {
    for (const url of ['/login', '/']) {
      const response = await client.get(url).withInertia()

      response.assertStatus(200)
      // login.tsx and the marketing layout show their links only when true
      assert.isFalse(response.body().props.signupOpen, url)
    }
  })
})
