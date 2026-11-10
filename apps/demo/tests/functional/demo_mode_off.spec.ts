import { test } from '@japa/runner'
import ace from '@adonisjs/core/services/ace'
import router from '@adonisjs/core/services/router'
import testUtils from '@adonisjs/core/services/test_utils'
import Category from '#models/category'
import User from '#models/user'
import DemoReset from '#commands/demo_reset'
import demo from '#config/demo'
import { createUser } from './admin/helpers.ts'

/**
 * With DEMO_MODE off (local dev and CI), none of the public demo exists.
 * tests/demo covers it with DEMO_MODE=true.
 */
test.group('Demo mode off', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.tap((t) => t.skip(demo.enabled, 'Runs with DEMO_MODE off'))

  test('the one-click sign-in routes do not exist', async ({ client, assert }) => {
    assert.isFalse(router.has('demo.sign_in'))
    assert.isFalse(router.has('demo.health'))
    for (const role of ['admin', 'editor', 'viewer']) {
      assert.isNull(router.match(`/demo/sign-in/${role}`, 'POST', false))

      const response = await client.post(`/demo/sign-in/${role}`).withCsrfToken().redirects(0)
      response.assertStatus(404)
      response.assertSessionMissing('auth_web')
    }
  })

  test('the login page has no demo buttons or banner, and no demo headers', async ({
    client,
    assert,
  }) => {
    const response = await client.get('/login').withInertia()

    response.assertStatus(200)
    assert.notProperty(response.body().props, 'demo')
    assert.isUndefined(response.header('x-robots-tag'))
    const cookies = ([] as string[]).concat(response.header('set-cookie') ?? [])
    assert.isFalse(cookies.some((line) => line.startsWith('azu_demo=')))
  })

  test('signup works as before, and the pages link to it', async ({ client, assert }) => {
    for (const url of ['/login', '/']) {
      const page = await client.get(url).withInertia()
      assert.isTrue(page.body().props.signupOpen, url)
    }

    const form = await client.get('/signup').withInertia()
    form.assertStatus(200)
    form.assertInertiaComponent('auth/signup')

    const email = `new-${Date.now()}@example.com`
    const response = await client
      .post('/signup')
      .withCsrfToken()
      .form({
        fullName: 'New Person',
        email,
        password: 'secret123',
        passwordConfirmation: 'secret123',
      })
      .redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/dashboard')
    const user = await User.findByOrFail('email', email)
    assert.equal(user.role, 'customer')
    response.assertSession('auth_web', user.id)
  })

  test('the panel has no Users resource', async ({ client }) => {
    const admin = await createUser('admin')
    const response = await client.get('/admin/resources/users').loginAs(admin).withInertia()

    response.assertStatus(404)
  })

  test('demo:reset refuses to run, and changes nothing', async ({ assert }) => {
    const category = await Category.create({ name: 'Kept', slug: `kept-${Date.now()}` })

    await ace.boot()
    ace.ui.switchMode('raw')
    const command = await ace.create(DemoReset, [])
    await command.exec()

    command.assertFailed()
    command.assertLogMatches(/only runs with DEMO_MODE=true/)
    assert.isNotNull(await Category.find(category.id))
  })
})
