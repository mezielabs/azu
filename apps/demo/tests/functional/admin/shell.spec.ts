import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { createUser } from './helpers.ts'

test.group('Admin / shell: signed-in user and sign out', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('every page gets the signed-in user for the sidebar', async ({ client, assert }) => {
    const admin = await createUser('admin')

    const response = await client.get('/admin').loginAs(admin).withInertia()

    assert.deepEqual(response.body().props.azu.user, {
      name: admin.fullName,
      email: admin.email,
    })
  })

  test('the forbidden page has the user too, so they can sign out', async ({ client, assert }) => {
    const customer = await createUser('customer')

    const response = await client.get('/admin').loginAs(customer).withInertia()

    response.assertStatus(403)
    assert.equal(response.body().props.azu.user.email, customer.email)
  })

  test('sign out ends the session and goes to the login page', async ({ client }) => {
    const admin = await createUser('admin')

    const response = await client.post('/admin/logout').loginAs(admin).withCsrfToken().redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/login')
  })

  test('an Inertia sign out leaves the admin app with a location response', async ({ client }) => {
    const admin = await createUser('admin')

    const response = await client
      .post('/admin/logout')
      .loginAs(admin)
      .withCsrfToken()
      .withInertia()
      .redirects(0)

    response.assertStatus(409)
    response.assertHeader('x-inertia-location', '/login')
  })

  test('a user without admin access can still sign out', async ({ client }) => {
    const customer = await createUser('customer')

    const response = await client
      .post('/admin/logout')
      .loginAs(customer)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/login')
  })

  test('forbidden: sign out without a CSRF token is refused', async ({ client, assert }) => {
    const admin = await createUser('admin')

    const response = await client.post('/admin/logout').loginAs(admin).redirects(0)

    assert.notEqual(response.header('location'), '/login')
  })
})
