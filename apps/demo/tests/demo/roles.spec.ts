import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Product from '#models/product'
import User from '#models/user'
import { clearRateLimits, demoAccount } from './helpers.ts'

const PRODUCTS = '/admin/resources/products'
const USERS = '/admin/resources/users'

function customer() {
  return User.query().where('role', 'customer').orderBy('id').firstOrFail()
}

function product() {
  return Product.query().orderBy('id').firstOrFail()
}

/**
 * What each role behind "Sign in as …" can do, on the server. Admins do
 * everything; the Editor (staff) edits without deleting, publishing, or
 * changing roles; the Viewer only lists and views.
 */
test.group('Demo / roles', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => clearRateLimits())

  test('admin: creates, deletes, publishes, and sees the role field', async ({
    client,
    assert,
  }) => {
    const admin = await demoAccount('admin')
    const list = await client.get(PRODUCTS).loginAs(admin).withInertia()
    list.assertInertiaPropsContains({ abilities: { create: true } })
    assert.includeMembers(list.body().props.list.rows[0].abilities.actions, ['row.delete'])

    const target = await customer()
    const edit = await client.get(`${USERS}/${target.id}/edit`).loginAs(admin).withInertia()
    edit.assertStatus(200)
    assert.include(
      edit.body().props.form.fields.map((field: { name: string }) => field.name),
      'role'
    )
  })

  test('editor: edits products, but no delete, no publish', async ({ client, assert }) => {
    const editor = await demoAccount('editor')
    const record = await product()

    const list = await client.get(PRODUCTS).loginAs(editor).withInertia()
    list.assertInertiaPropsContains({ abilities: { create: false } })
    const row = list.body().props.list.rows[0]
    assert.isTrue(row.abilities.update)
    assert.deepEqual(row.abilities.actions, [])

    const edit = await client.get(`${PRODUCTS}/${record.id}/edit`).loginAs(editor).withInertia()
    edit.assertStatus(200)

    for (const path of ['row/delete', 'bulk/delete', 'bulk/publish']) {
      const response = await client
        .post(`${PRODUCTS}/actions/${path}`)
        .loginAs(editor)
        .withCsrfToken()
        .json({ ids: [record.id] })
      response.assertStatus(403)
    }
    assert.isNotNull(await Product.find(record.id))
  })

  test("editor: the role field (.ability('changeRole')) is hidden and ignored", async ({
    client,
    assert,
  }) => {
    const editor = await demoAccount('editor')
    const target = await customer()

    const edit = await client.get(`${USERS}/${target.id}/edit`).loginAs(editor).withInertia()
    edit.assertStatus(200)
    assert.notInclude(
      edit.body().props.form.fields.map((field: { name: string }) => field.name),
      'role'
    )

    const response = await client
      .put(`${USERS}/${target.id}/edit`)
      .loginAs(editor)
      .withInertia()
      .withCsrfToken()
      .json({ fullName: 'Renamed by editor', email: target.email, role: 'admin' })
      .redirects(0)
    response.assertStatus(303)

    await target.refresh()
    assert.equal(target.fullName, 'Renamed by editor')
    assert.equal(target.role, 'customer')
  })

  test('viewer: lists and views, nothing else', async ({ client, assert }) => {
    const viewer = await demoAccount('viewer')
    const record = await product()

    const list = await client.get(PRODUCTS).loginAs(viewer).withInertia()
    list.assertStatus(200)
    list.assertInertiaPropsContains({ abilities: { create: false } })
    const row = list.body().props.list.rows[0]
    assert.isTrue(row.abilities.view)
    assert.isFalse(row.abilities.update)

    const show = await client.get(`${PRODUCTS}/${record.id}`).loginAs(viewer).withInertia()
    show.assertStatus(200)
    assert.deepEqual(show.body().props.abilities, { update: false, actions: [] })

    for (const url of ['/admin/resources/coupons', USERS]) {
      const response = await client.get(url).loginAs(viewer).withInertia()
      response.assertStatus(200)
    }
  })

  test('forbidden: the viewer cannot open a form, save, or run an action', async ({
    client,
    assert,
  }) => {
    const viewer = await demoAccount('viewer')
    const record = await product()
    const target = await customer()

    for (const url of [
      `${PRODUCTS}/create`,
      `${PRODUCTS}/${record.id}/edit`,
      `${USERS}/${target.id}/edit`,
    ]) {
      const response = await client.get(url).loginAs(viewer).withInertia()
      response.assertStatus(403)
    }

    const save = await client
      .put(`${PRODUCTS}/${record.id}/edit`)
      .loginAs(viewer)
      .withInertia()
      .withCsrfToken()
      .json({ name: 'Viewer was here' })
    save.assertStatus(403)

    const rename = await client
      .put(`${USERS}/${target.id}/edit`)
      .loginAs(viewer)
      .withInertia()
      .withCsrfToken()
      .json({ fullName: 'Viewer was here', email: target.email })
    rename.assertStatus(403)

    const restock = await client
      .post(`${PRODUCTS}/actions/row/restock`)
      .loginAs(viewer)
      .withCsrfToken()
      .json({ ids: [record.id], input: { quantity: 1 } })
    restock.assertStatus(403)

    await record.refresh()
    await target.refresh()
    assert.notEqual(record.name, 'Viewer was here')
    assert.notEqual(target.fullName, 'Viewer was here')
  })

  test('the admin-only pages stay admin-only for the editor and viewer', async ({ client }) => {
    for (const role of ['editor', 'viewer'] as const) {
      const user = await demoAccount(role)
      for (const url of ['/admin/resources/categories', '/admin/resources/orders']) {
        const response = await client.get(url).loginAs(user).withInertia()
        response.assertStatus(403)
      }
    }
  })
})
