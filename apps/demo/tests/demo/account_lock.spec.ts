import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import type { DemoRole } from '#config/demo'
import { clearRateLimits, demoAccount } from './helpers.ts'

const USERS = '/admin/resources/users'
const ROLES: DemoRole[] = ['admin', 'editor', 'viewer']

/**
 * With DEMO_MODE on, no one can change the accounts behind "Sign in as …":
 * UserPolicy denies it on the server, whatever the request sends.
 */
test.group('Demo / locked demo accounts', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => clearRateLimits())

  test('forbidden: not even an admin can change a demo account', async ({ client, assert }) => {
    const admin = await demoAccount('admin')

    for (const role of ROLES) {
      const target = await demoAccount(role)
      const response = await client
        .put(`${USERS}/${target.id}/edit`)
        .loginAs(admin)
        .withInertia()
        .withCsrfToken()
        .json({ fullName: 'Taken over', email: 'taken@example.com', role: 'customer' })
      response.assertStatus(403)

      const after = await User.findOrFail(target.id)
      assert.equal(after.email, target.email)
      assert.equal(after.role, target.role)
      assert.equal(after.fullName, target.fullName)
    }
  })

  test('forbidden: the editor cannot change one either, nor its password', async ({
    client,
    assert,
  }) => {
    const editor = await demoAccount('editor')
    const target = await demoAccount('admin')
    const hash = target.password

    const response = await client
      .put(`${USERS}/${target.id}/edit`)
      .loginAs(editor)
      .withInertia()
      .withCsrfToken()
      .json({ email: target.email, password: 'new-password-123' })
    response.assertStatus(403)

    await target.refresh()
    assert.equal(target.password, hash)
  })

  test("a demo account's edit form is forbidden and its detail page has no Edit", async ({
    client,
    assert,
  }) => {
    const admin = await demoAccount('admin')
    const target = await demoAccount('viewer')

    const edit = await client.get(`${USERS}/${target.id}/edit`).loginAs(admin).withInertia()
    edit.assertStatus(403)

    const show = await client.get(`${USERS}/${target.id}`).loginAs(admin).withInertia()
    show.assertStatus(200)
    assert.isFalse(show.body().props.abilities.update)
  })

  test('other users stay editable: an admin changes a customer role', async ({
    client,
    assert,
  }) => {
    const admin = await demoAccount('admin')
    const target = await User.query().where('role', 'customer').orderBy('id').firstOrFail()

    const response = await client
      .put(`${USERS}/${target.id}/edit`)
      .loginAs(admin)
      .withInertia()
      .withCsrfToken()
      .json({ fullName: target.fullName, email: target.email, role: 'viewer' })
      .redirects(0)
    response.assertStatus(303)

    await target.refresh()
    assert.equal(target.role, 'viewer')
  })
})
