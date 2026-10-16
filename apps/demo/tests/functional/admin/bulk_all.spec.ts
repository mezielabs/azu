import { randomUUID } from 'node:crypto'
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import productResource from '#admin/resources/product_resource'
import Category from '#models/category'
import Order from '#models/order'
import Product from '#models/product'
import { createUser, insertProducts } from './helpers.ts'

const PUBLISH = '/admin/resources/products/actions/bulk/publish'
const unique = () => randomUUID().slice(0, 8).toUpperCase()

async function category() {
  return Category.create({ name: `Kitchen ${unique()}`, slug: `k-${unique()}` })
}

async function statuses(kitchen: Category) {
  const rows = await Product.query().where('categoryId', kitchen.id).orderBy('id', 'asc')
  return rows.map((product) => product.status)
}

async function allAre(kitchen: Category, status: Product['status']) {
  const all = await statuses(kitchen)
  return all.every((value) => value === status)
}

/**
 * Wraps the publish action's handler for one test: `spy` sees each
 * chunk before the real handler runs, and may throw.
 */
function spyOnPublish(spy: (products: Product[], call: number) => Promise<void> | void) {
  const publish = productResource.actions().find((item) => item.name === 'publish')!
  const original = publish.handler!
  let call = 0
  publish.handle((async (products: Product[], context: unknown) => {
    await spy(products, ++call)
    return (original as (records: unknown, context: unknown) => unknown)(products, context)
  }) as never)
  return () => {
    publish.handle(original as never)
  }
}

test.group('Admin / bulk actions on all matching rows (FR-17)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('runs over every matching row in chunks of 500, one handler call each', async ({
    client,
    assert,
    cleanup,
  }) => {
    const admin = await createUser('admin')
    const kitchen = await category()
    const garden = await category()
    await insertProducts(kitchen, 1203)
    await insertProducts(garden, 5)
    const chunks: number[] = []
    cleanup(spyOnPublish((products) => void chunks.push(products.length)))

    const response = await client
      .post(PUBLISH)
      .loginAs(admin)
      .withCsrfToken()
      .json({ matching: { search: '', filters: { category: String(kitchen.id) }, count: 1203 } })

    response.assertStatus(200)
    assert.deepEqual(response.body(), {
      message: 'Publish: done for 1,203 products.',
      redirect: null,
      done: 1203,
      skipped: 0,
      failed: 0,
    })
    assert.deepEqual(chunks, [500, 500, 203])
    assert.isTrue(await allAre(kitchen, 'published'))
    // Outside the filter: untouched
    assert.isTrue(await allAre(garden, 'draft'))
  })

  test('applies the search and filters as the list does', async ({ client, assert }) => {
    const admin = await createUser('admin')
    const kitchen = await category()
    await insertProducts(kitchen, 3, 'Clay vase')
    await insertProducts(kitchen, 4, 'Steel pan')

    const response = await client
      .post(PUBLISH)
      .loginAs(admin)
      .withCsrfToken()
      .json({
        matching: {
          search: 'clay',
          filters: { category: String(kitchen.id), status: 'draft', unknown: 'x' },
          count: 3,
        },
      })

    response.assertStatus(200)
    assert.equal(response.body().done, 3)
    const vases = await Product.query().where('categoryId', kitchen.id).where('name', 'Clay vase')
    assert.isTrue(vases.every((product) => product.status === 'published'))
    const pans = await Product.query().where('categoryId', kitchen.id).where('name', 'Steel pan')
    assert.isTrue(pans.every((product) => product.status === 'draft'))
  })

  test('a failed chunk rolls back alone: earlier chunks stay committed and the rest are counted as failed', async ({
    client,
    assert,
    cleanup,
  }) => {
    const admin = await createUser('admin')
    const kitchen = await category()
    await insertProducts(kitchen, 1203)
    cleanup(
      spyOnPublish(async (products, call) => {
        if (call !== 2) return
        // Changed, then rolled back with the chunk
        await Product.query({ client: products[0].$trx })
          .whereIn(
            'id',
            products.map((product) => product.id)
          )
          .update({ status: 'published' })
        throw new Error('Search index unavailable')
      })
    )

    const response = await client
      .post(PUBLISH)
      .loginAs(admin)
      .withCsrfToken()
      .json({ matching: { search: '', filters: { category: String(kitchen.id) }, count: 1203 } })

    response.assertStatus(200)
    assert.deepEqual(response.body(), {
      message:
        "Publish stopped after 500 products at a failed batch. Those stay done; 703 products weren't changed.",
      redirect: null,
      done: 500,
      skipped: 0,
      failed: 703,
    })
    const after = await statuses(kitchen)
    // By key: the first chunk is the first 500 rows
    assert.deepEqual(after.slice(0, 500).filter((status) => status === 'published').length, 500)
    assert.isTrue(after.slice(500).every((status) => status === 'draft'))
  })

  test('a failure in the first chunk changes nothing', async ({ client, assert, cleanup }) => {
    const admin = await createUser('admin')
    const kitchen = await category()
    await insertProducts(kitchen, 600)
    cleanup(
      spyOnPublish(() => {
        throw new Error('boom')
      })
    )

    const response = await client
      .post(PUBLISH)
      .loginAs(admin)
      .withCsrfToken()
      .json({ matching: { search: '', filters: { category: String(kitchen.id) }, count: 600 } })

    response.assertStatus(500)
    assert.equal(response.body().message, 'Publish failed, so nothing was changed.')
    assert.isTrue(await allAre(kitchen, 'draft'))
  })

  test('rows that stop matching mid-run are skipped; rows that appear are left out', async ({
    client,
    assert,
    cleanup,
  }) => {
    const admin = await createUser('admin')
    const kitchen = await category()
    const garden = await category()
    await insertProducts(kitchen, 600)
    const last = await Product.query()
      .where('categoryId', kitchen.id)
      .orderBy('id', 'desc')
      .firstOrFail()
    cleanup(
      spyOnPublish(async (_products, call) => {
        if (call !== 1) return
        // Another admin's edits, while the run is going
        await Product.query().where('id', last.id).update({ categoryId: garden.id })
        await Product.create({
          categoryId: kitchen.id,
          name: 'Late pot',
          sku: `LATE-${unique()}`,
          price: '5.00',
          stock: 1,
          status: 'draft',
          isFeatured: false,
        })
      })
    )

    const response = await client
      .post(PUBLISH)
      .loginAs(admin)
      .withCsrfToken()
      .json({ matching: { search: '', filters: { category: String(kitchen.id) }, count: 600 } })

    response.assertStatus(200)
    assert.containsSubset(response.body(), {
      message: 'Publish: done for 599 products. Skipped 1 that no longer matched.',
      done: 599,
      skipped: 1,
      failed: 0,
    })
    const late = await Product.findByOrFail('name', 'Late pot')
    assert.equal(late.status, 'draft')
    await last.refresh()
    assert.equal(last.status, 'draft')
  })

  test('records the policy denies are skipped and reported', async ({ client, assert }) => {
    const admin = await createUser('admin')
    const customer = await createUser('customer')
    const placed = await Order.createMany(
      ['pending', 'pending', 'cancelled'].map((status) => ({
        userId: customer.id,
        number: `T-${unique()}`,
        status: status as Order['status'],
        total: '10.00',
        placedAt: DateTime.now(),
      }))
    )

    const response = await client
      .post('/admin/resources/orders/actions/bulk/cancel')
      .loginAs(admin)
      .withCsrfToken()
      .json({ matching: { search: '', filters: {}, count: placed.length } })

    response.assertStatus(200)
    assert.containsSubset(response.body(), {
      message: "Cancel: done for 2 orders. Skipped 1 you can't cancel.",
      done: 2,
      skipped: 1,
    })
  })

  test('more than 10,000 matching is refused before anything changes', async ({
    client,
    assert,
  }) => {
    const admin = await createUser('admin')
    const kitchen = await category()
    await insertProducts(kitchen, 10_001)

    const response = await client
      .post(PUBLISH)
      .loginAs(admin)
      .withCsrfToken()
      .json({ matching: { search: '', filters: { category: String(kitchen.id) }, count: 10_001 } })

    response.assertStatus(422)
    assert.match(response.body().message, /More than 10,000 products match/)
    const published = await Product.query()
      .where('categoryId', kitchen.id)
      .where('status', 'published')
    assert.lengthOf(published, 0)
  })

  test('more matching than the user confirmed is refused', async ({ client, assert }) => {
    const admin = await createUser('admin')
    const kitchen = await category()
    await insertProducts(kitchen, 12)

    const response = await client
      .post(PUBLISH)
      .loginAs(admin)
      .withCsrfToken()
      .json({ matching: { search: '', filters: { category: String(kitchen.id) }, count: 10 } })

    response.assertStatus(409)
    assert.equal(
      response.body().message,
      '12 products match now, more than the 10 you confirmed. Nothing was changed. Check the list and run it again.'
    )
    assert.isTrue(await allAre(kitchen, 'draft'))
  })

  test('forbidden: staff may list but not publish, and customers may not list', async ({
    client,
    assert,
  }) => {
    const kitchen = await category()
    await insertProducts(kitchen, 3)
    const body = { matching: { search: '', filters: { category: String(kitchen.id) }, count: 3 } }

    const staff = await client
      .post(PUBLISH)
      .loginAs(await createUser('staff'))
      .withCsrfToken()
      .json(body)
    staff.assertStatus(403)
    assert.equal(staff.body().message, "You can't publish any of the matching products.")

    const customer = await client
      .post(PUBLISH)
      .loginAs(await createUser('customer'))
      .withCsrfToken()
      .json(body)
    customer.assertStatus(403)

    assert.isTrue(await allAre(kitchen, 'draft'))
  })

  test('a malformed matching body is a 422', async ({ client }) => {
    const admin = await createUser('admin')
    const response = await client
      .post(PUBLISH)
      .loginAs(admin)
      .withCsrfToken()
      .json({ matching: { search: '', filters: {}, count: 0 } })
    response.assertStatus(422)
  })
})
