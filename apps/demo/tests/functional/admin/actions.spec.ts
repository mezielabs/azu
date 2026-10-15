import { randomUUID } from 'node:crypto'
import { test } from '@japa/runner'
import drive from '@adonisjs/drive/services/main'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import Category from '#models/category'
import Coupon from '#models/coupon'
import Order from '#models/order'
import Product from '#models/product'
import { createUser } from './helpers.ts'

const unique = () => randomUUID().slice(0, 8).toUpperCase()

async function createProduct(overrides: Partial<Product> = {}) {
  const category = await Category.create({ name: 'Kitchen', slug: `k-${unique()}` })
  return Product.create({
    categoryId: category.id,
    name: 'Clay pot',
    sku: `T-${unique()}`,
    price: '5.00',
    stock: 2,
    status: 'draft',
    isFeatured: false,
    ...overrides,
  })
}

async function createOrder(status: Order['status']) {
  const customer = await createUser('customer')
  return Order.create({
    userId: customer.id,
    number: `T-${unique()}`,
    status,
    total: '10.00',
    placedAt: DateTime.now(),
  })
}

function createCoupon() {
  return Coupon.create({
    code: `T${unique()}`,
    kind: 'percent',
    amount: '10.00',
    currency: 'NGN',
    isActive: true,
    startsOn: DateTime.fromISO('2026-10-01'),
  })
}

test.group('Admin / row actions (FR-12)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('a row action with a dialog runs through its validator', async ({ client, assert }) => {
    const admin = await createUser('admin')
    const product = await createProduct({ stock: 2 })

    const response = await client
      .post('/admin/resources/products/actions/row/restock')
      .loginAs(admin)
      .withCsrfToken()
      .json({ ids: [product.id], input: { quantity: 5 } })

    response.assertStatus(200)
    assert.deepEqual(response.body(), {
      message: 'Clay pot now has 7 in stock',
      redirect: null,
      done: 1,
      skipped: 0,
    })
    await product.refresh()
    assert.equal(product.stock, 7)
  })

  test('invalid dialog input is a 422 under its field, and changes nothing', async ({
    client,
    assert,
  }) => {
    const admin = await createUser('admin')
    const product = await createProduct({ stock: 2 })

    const response = await client
      .post('/admin/resources/products/actions/row/restock')
      .loginAs(admin)
      .withCsrfToken()
      .json({ ids: [product.id], input: { quantity: 0 } })

    response.assertStatus(422)
    assert.property(response.body().errors, 'quantity')
    await product.refresh()
    assert.equal(product.stock, 2)
  })

  test('forbidden: staff cannot run restock (ProductPolicy.restock)', async ({
    client,
    assert,
  }) => {
    const staff = await createUser('staff')
    const product = await createProduct({ stock: 2 })

    // The policy is checked before the input, so even invalid input gets a 403
    for (const quantity of [5, 0]) {
      const response = await client
        .post('/admin/resources/products/actions/row/restock')
        .loginAs(staff)
        .withCsrfToken()
        .json({ ids: [product.id], input: { quantity } })
      response.assertStatus(403)
    }
    await product.refresh()
    assert.equal(product.stock, 2)
  })

  test('a row action runs on exactly one record', async ({ client }) => {
    const admin = await createUser('admin')
    const [a, b] = [await createProduct(), await createProduct()]

    const response = await client
      .post('/admin/resources/products/actions/row/restock')
      .loginAs(admin)
      .withCsrfToken()
      .json({ ids: [a.id, b.id], input: { quantity: 1 } })
    response.assertStatus(422)
  })

  test('unknown actions are a 404', async ({ client }) => {
    const admin = await createUser('admin')
    const product = await createProduct()

    for (const path of ['row/nope', 'sideways/restock', 'bulk/restock']) {
      const response = await client
        .post(`/admin/resources/products/actions/${path}`)
        .loginAs(admin)
        .withCsrfToken()
        .json({ ids: [product.id] })
      response.assertStatus(404)
    }
  })
})

test.group('Admin / bulk actions (FR-12)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('a bulk action runs on the selected records', async ({ client, assert }) => {
    const admin = await createUser('admin')
    const products = [await createProduct(), await createProduct()]

    const response = await client
      .post('/admin/resources/products/actions/bulk/publish')
      .loginAs(admin)
      .withCsrfToken()
      .json({ ids: products.map((product) => product.id) })

    response.assertStatus(200)
    assert.containsSubset(response.body(), { message: '2 products published', done: 2 })
    for (const product of products) {
      await product.refresh()
      assert.equal(product.status, 'published')
    }
  })

  test('forbidden: staff cannot publish (ProductPolicy.publish)', async ({ client, assert }) => {
    const staff = await createUser('staff')
    const product = await createProduct()

    const response = await client
      .post('/admin/resources/products/actions/bulk/publish')
      .loginAs(staff)
      .withCsrfToken()
      .json({ ids: [product.id] })

    response.assertStatus(403)
    await product.refresh()
    assert.equal(product.status, 'draft')
  })

  test('records the user cannot touch are skipped and reported', async ({ client, assert }) => {
    const admin = await createUser('admin')
    const [pending, cancelled] = [await createOrder('pending'), await createOrder('cancelled')]

    const response = await client
      .post('/admin/resources/orders/actions/bulk/cancel')
      .loginAs(admin)
      .withCsrfToken()
      // A missing id counts as skipped too
      .json({ ids: [pending.id, cancelled.id, 2147483000] })

    response.assertStatus(200)
    assert.containsSubset(response.body(), { done: 1, skipped: 2 })
    assert.match(response.body().message, /Skipped 2 you can't cancel/)
    await pending.refresh()
    assert.equal(pending.status, 'cancelled')
  })

  test('a thrown error rolls the whole batch back', async ({ client, assert }) => {
    const admin = await createUser('admin')
    const [pending, shipped] = [await createOrder('pending'), await createOrder('shipped')]

    const response = await client
      .post('/admin/resources/orders/actions/bulk/cancel')
      .loginAs(admin)
      .withCsrfToken()
      .json({ ids: [pending.id, shipped.id] })

    response.assertStatus(422)
    assert.equal(
      response.body().message,
      `Order ${shipped.number} has shipped, so it can't be cancelled.`
    )
    // The pending order was cancelled first, then rolled back
    await pending.refresh()
    assert.equal(pending.status, 'pending')
  })

  test('forbidden: staff cannot cancel orders (OrderPolicy.cancel)', async ({ client, assert }) => {
    const staff = await createUser('staff')
    const order = await createOrder('pending')

    const response = await client
      .post('/admin/resources/orders/actions/bulk/cancel')
      .loginAs(staff)
      .withCsrfToken()
      .json({ ids: [order.id] })

    response.assertStatus(403)
    await order.refresh()
    assert.equal(order.status, 'pending')
  })

  test('a bulk action takes at most 1,000 records', async ({ client }) => {
    const admin = await createUser('admin')
    const response = await client
      .post('/admin/resources/products/actions/bulk/publish')
      .loginAs(admin)
      .withCsrfToken()
      .json({ ids: Array.from({ length: 1001 }, (_, i) => i + 1) })
    response.assertStatus(422)
  })
})

test.group('Admin / Delete (FR-12)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('the built-in Delete removes a record (row)', async ({ client, assert }) => {
    const admin = await createUser('admin')
    const coupon = await createCoupon()

    const response = await client
      .post('/admin/resources/coupons/actions/row/delete')
      .loginAs(admin)
      .withCsrfToken()
      .json({ ids: [coupon.id] })

    response.assertStatus(200)
    assert.equal(response.body().message, 'Deleted 1 coupon')
    assert.isNull(await Coupon.find(coupon.id))
  })

  test('and the selected records (bulk)', async ({ client, assert }) => {
    const admin = await createUser('admin')
    const coupons = [await createCoupon(), await createCoupon()]

    const response = await client
      .post('/admin/resources/coupons/actions/bulk/delete')
      .loginAs(admin)
      .withCsrfToken()
      .json({ ids: coupons.map((coupon) => coupon.id) })

    response.assertStatus(200)
    assert.equal(response.body().message, 'Deleted 2 coupons')
    assert.lengthOf(
      await Coupon.query().whereIn(
        'id',
        coupons.map((coupon) => coupon.id)
      ),
      0
    )
  })

  test('forbidden: staff cannot delete coupons (CouponPolicy.delete)', async ({
    client,
    assert,
  }) => {
    const staff = await createUser('staff')
    const coupon = await createCoupon()

    for (const kind of ['row', 'bulk']) {
      const response = await client
        .post(`/admin/resources/coupons/actions/${kind}/delete`)
        .loginAs(staff)
        .withCsrfToken()
        .json({ ids: [coupon.id] })
      response.assertStatus(403)
    }
    assert.isNotNull(await Coupon.find(coupon.id))
  })

  test('a policy without delete has no Delete (OrderPolicy)', async ({ client }) => {
    const admin = await createUser('admin')
    const order = await createOrder('pending')

    const response = await client
      .post('/admin/resources/orders/actions/row/delete')
      .loginAs(admin)
      .withCsrfToken()
      .json({ ids: [order.id] })
    response.assertStatus(404)
  })

  test('deleting a record deletes its stored files', async ({ client, assert }) => {
    const disk = drive.fake('fs')
    try {
      const admin = await createUser('admin')
      const product = await createProduct({ thumbnail: 'products/thumbnail/gone.png' })
      await disk.put('products/thumbnail/gone.png', 'x')

      const response = await client
        .post('/admin/resources/products/actions/row/delete')
        .loginAs(admin)
        .withCsrfToken()
        .json({ ids: [product.id] })

      response.assertStatus(200)
      assert.isNull(await Product.find(product.id))
      disk.assertMissing('products/thumbnail/gone.png')
    } finally {
      drive.restore('fs')
    }
  })
})

test.group('Admin / action abilities (FR-12)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('list rows say which actions the user may run on them', async ({ client, assert }) => {
    const [admin, staff] = [await createUser('admin'), await createUser('staff')]
    const coupon = await createCoupon()

    const asAdmin = await client
      .get(`/admin/resources/coupons?search=${coupon.code}`)
      .loginAs(admin)
      .withInertia()
    assert.sameMembers(asAdmin.body().props.list.rows[0].abilities.actions, [
      'row.delete',
      'bulk.delete',
    ])

    const asStaff = await client
      .get(`/admin/resources/coupons?search=${coupon.code}`)
      .loginAs(staff)
      .withInertia()
    assert.deepEqual(asStaff.body().props.list.rows[0].abilities.actions, [])
  })

  test('the detail page lists the row actions the user may run', async ({ client, assert }) => {
    const [admin, staff] = [await createUser('admin'), await createUser('staff')]
    const product = await createProduct()

    const asAdmin = await client
      .get(`/admin/resources/products/${product.id}`)
      .loginAs(admin)
      .withInertia()
    assert.sameMembers(asAdmin.body().props.abilities.actions, ['row.restock', 'row.delete'])

    const asStaff = await client
      .get(`/admin/resources/products/${product.id}`)
      .loginAs(staff)
      .withInertia()
    assert.deepEqual(asStaff.body().props.abilities.actions, [])
  })

  test('the schema describes each action, with the built-in Delete', async ({ client, assert }) => {
    const admin = await createUser('admin')
    const response = await client.get('/admin/resources/products').loginAs(admin).withInertia()

    const actions = response.body().props.resource.actions
    assert.deepEqual(
      actions.map((item: any) => `${item.kind}.${item.name}`),
      ['bulk.publish', 'row.restock', 'row.delete', 'bulk.delete']
    )
    const restock = actions.find((item: any) => item.name === 'restock')
    assert.containsSubset(restock.fields[0], {
      name: 'quantity',
      required: true,
      min: 1,
      max: 10000,
    })
    const remove = actions.find((item: any) => item.name === 'delete')
    assert.containsSubset(remove, {
      destructive: true,
      ability: 'delete',
      confirm: 'Delete this product?',
    })
  })
})
