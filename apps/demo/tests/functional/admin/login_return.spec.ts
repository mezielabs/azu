import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { createUser } from './helpers.ts'

test.group('Admin login return', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('remembers guest navigations with their query string, including Inertia', async ({
    client,
  }) => {
    for (const destination of [
      '/admin',
      '/admin/resources/products/12/edit',
      '/admin/resources/products?search=clay&sort=name',
    ]) {
      const response = await client.get(destination).redirects(0)
      response.assertSession('redirect.intendedUrl', destination)
      const inertia = await client.get(destination).withInertia().redirects(0)
      inertia.assertSession('redirect.intendedUrl', destination)
    }
  })

  test('successful login consumes a local destination and otherwise uses the dashboard', async ({
    client,
  }) => {
    const admin = await createUser('admin')
    for (const destination of [
      '/admin',
      '/admin/resources/products/12/edit',
      '/admin/resources/products?search=clay&sort=name',
      undefined,
      'https://example.com',
      '//example.com',
      '/\\example.com',
      'javascript:alert(1)',
    ]) {
      const response = await client
        .post('/login')
        .withSession(destination ? { redirect: { intendedUrl: destination } } : {})
        .withCsrfToken()
        .form({ email: admin.email, password: 'secret-password' })
        .redirects(0)
      response.assertStatus(302)
      response.assertHeader(
        'location',
        destination?.startsWith('/admin') ? destination : '/dashboard'
      )
      response.assertSessionMissing('redirect.intendedUrl')
    }
  })

  test('Inertia login loads the admin entry point with a location response', async ({ client }) => {
    const admin = await createUser('admin')
    const response = await client
      .post('/login')
      .withSession({ redirect: { intendedUrl: '/admin' } })
      .withInertia()
      .withCsrfToken()
      .form({ email: admin.email, password: 'secret-password' })
      .redirects(0)
    response.assertStatus(409)
    response.assertHeader('x-inertia-location', '/admin')
    response.assertSessionMissing('redirect.intendedUrl')
  })

  test('failed login preserves the destination', async ({ client }) => {
    const admin = await createUser('admin')
    const destination = '/admin/resources/products?search=clay'
    const response = await client
      .post('/login')
      .withSession(destination ? { redirect: { intendedUrl: destination } } : {})
      .withCsrfToken()
      .form({ email: admin.email, password: 'wrong-password' })
      .redirects(0)
    response.assertSession('redirect.intendedUrl', destination)
  })

  test('the returned destination still forbids users without admin access', async ({ client }) => {
    const customer = await createUser('customer')
    const response = await client
      .post('/login')
      .withSession({ redirect: { intendedUrl: '/admin' } })
      .withCsrfToken()
      .form({ email: customer.email, password: 'secret-password' })
      .redirects(0)
    response.assertHeader('location', '/admin')
    const destination = await client.get('/admin').loginAs(customer).withInertia()
    destination.assertStatus(403)
  })
})
