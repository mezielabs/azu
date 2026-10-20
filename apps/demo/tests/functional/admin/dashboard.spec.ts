import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { createUser, withHome } from './helpers.ts'

test.group('Admin / dashboard (FR-01)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('without a home, renders the azu/dashboard page under /admin', async ({
    client,
    cleanup,
  }) => {
    withHome(null, cleanup)
    const admin = await createUser('admin')
    const response = await client.get('/admin').loginAs(admin).withInertia()

    response.assertStatus(200)
    response.assertInertiaComponent('azu/dashboard')
    response.assertInertiaPropsContains({ azu: { path: '/admin' } })
  })

  test('renders the admin root view with the admin entry, not the app entry', async ({
    client,
    assert,
  }) => {
    const admin = await createUser('admin')
    const response = await client.get('/admin').loginAs(admin)

    response.assertStatus(200)
    assert.include(response.text(), 'inertia/admin/app.tsx')
    assert.notInclude(response.text(), 'src="/inertia/app.tsx"')
  })

  test('public pages never reference the admin entry', async ({ client, assert }) => {
    const response = await client.get('/')

    response.assertStatus(200)
    assert.notInclude(response.text(), 'inertia/admin')
  })
})
