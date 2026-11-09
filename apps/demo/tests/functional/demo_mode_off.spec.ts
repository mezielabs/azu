import { test } from '@japa/runner'
import ace from '@adonisjs/core/services/ace'
import router from '@adonisjs/core/services/router'
import testUtils from '@adonisjs/core/services/test_utils'
import Category from '#models/category'
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
