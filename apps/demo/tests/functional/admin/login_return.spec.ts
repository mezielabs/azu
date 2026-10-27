import { readFile } from 'node:fs/promises'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
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

  test("JSON endpoints and partial reloads don't replace the destination", async ({ client }) => {
    const destination = '/admin/resources/products?search=clay'
    const saved = { redirect: { intendedUrl: destination } }
    for (const url of [
      '/admin/resources/products/fields/category/options?search=kit',
      '/admin/resources/products/filters/category/options',
    ]) {
      // What the front end sends, and what a bare fetch() or a browser would
      for (const accept of ['application/json', '*/*', 'text/html']) {
        const response = await client
          .get(url)
          .withSession(saved)
          .header('accept', accept)
          .redirects(0)
        // The access gate answered: sent to log in, not a 404
        response.assertStatus(302)
        response.assertSession('redirect.intendedUrl', destination)
      }
    }
    // A partial reload, `only` or `except`
    for (const header of ['x-inertia-partial-data', 'x-inertia-partial-except']) {
      const response = await client
        .get('/admin/screens/overview?range=7d')
        .withSession(saved)
        .withInertia()
        .header('x-inertia-partial-component', 'azu/screen')
        .header(header, 'widget0')
        .redirects(0)
      response.assertStatus(409)
      response.assertSession('redirect.intendedUrl', destination)
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

  test("the README's login snippet is the demo's controller", async ({ assert }) => {
    const readme = await readFile(new URL('../../../../../README.md', import.meta.url), 'utf8')
    const snippet = readme.match(
      /```ts\n\/\/ app\/controllers\/session_controller\.ts\n([\s\S]*?)```/
    )
    assert.isNotNull(snippet, 'the README has the login snippet')
    const [imports, method] = snippet![1].split(/\n\n(?=async store)/)
    const controller = await readFile(app.makePath('app/controllers/session_controller.ts'), 'utf8')
    assert.include(controller, imports.trim())
    // The same method, indented as a class member
    const indented = method.trimEnd().replace(/^(?=.)/gm, '  ')
    assert.include(controller, indented)
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
