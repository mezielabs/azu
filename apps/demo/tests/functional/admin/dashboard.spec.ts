import { test } from '@japa/runner'

test.group('Admin / dashboard (FR-01)', () => {
  test('renders the azu/dashboard page under /admin', async ({ client }) => {
    const response = await client.get('/admin').withInertia()

    response.assertStatus(200)
    response.assertInertiaComponent('azu/dashboard')
    response.assertInertiaProps({ azu: { path: '/admin' } })
  })

  test('renders the admin root view with the admin entry, not the app entry', async ({
    client,
    assert,
  }) => {
    const response = await client.get('/admin')

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
