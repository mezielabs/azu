import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { createUser } from './helpers.ts'

/**
 * FR-02: guests redirect to the app's login; signed-in users failing
 * the accessAdmin ability (app/abilities/main.ts: admins and staff only)
 * get a 403.
 */
test.group('Admin / access gate (FR-02)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('redirects guests to the login page', async ({ client }) => {
    const response = await client.get('/admin').redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/login')
  })

  test('sends guests on Inertia visits a location response', async ({ client }) => {
    const response = await client.get('/admin').withInertia().redirects(0)

    response.assertStatus(409)
    response.assertHeader('x-inertia-location', '/login')
  })

  test('forbids signed-in users who fail accessAdmin', async ({ client }) => {
    const customer = await createUser('customer')
    const response = await client.get('/admin').loginAs(customer).withInertia()

    response.assertStatus(403)
    response.assertInertiaComponent('azu/errors/forbidden')
  })

  test('forbids them on a full page load too', async ({ client, assert }) => {
    const customer = await createUser('customer')
    const response = await client.get('/admin').loginAs(customer)

    response.assertStatus(403)
    // Inertia embeds the page object as JSON, with escaped slashes
    assert.include(response.text(), '"component":"azu\\/errors\\/forbidden"')
  })

  test('lets staff in', async ({ client }) => {
    const staff = await createUser('staff')
    const response = await client.get('/admin').loginAs(staff).withInertia()

    response.assertStatus(200)
    // The demo's home screen (FR-22)
    response.assertInertiaComponent('azu/screen')
  })

  test('lets admins in', async ({ client }) => {
    const admin = await createUser('admin')
    const response = await client.get('/admin').loginAs(admin).withInertia()

    response.assertStatus(200)
    response.assertInertiaComponent('azu/screen')
  })
})
