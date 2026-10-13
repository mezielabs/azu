import { randomUUID } from 'node:crypto'
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import Category from '#models/category'
import Order from '#models/order'
import Product from '#models/product'
import { createUser } from './helpers.ts'

/**
 * Products named "<prefix> item 01..n" across `categories` categories,
 * priced 1.00, 2.00, ... so sort order is easy to check. Searching for
 * the prefix scopes a test to its own rows, even on a seeded database.
 */
async function createCatalog(count: number, categories = 3) {
  const prefix = `t${randomUUID().slice(0, 6)}`
  const made = await Category.createMany(
    Array.from({ length: categories }, (_, i) => ({
      name: `${prefix} cat ${i}`,
      slug: `${prefix}-cat-${i}`,
    }))
  )
  await Product.createMany(
    Array.from({ length: count }, (_, i) => ({
      categoryId: made[i % categories].id,
      name: `${prefix} item ${String(i + 1).padStart(2, '0')}`,
      sku: `${prefix.toUpperCase()}-${i + 1}`,
      price: `${i + 1}.00`,
      stock: i,
      status: i % 2 ? ('published' as const) : ('draft' as const),
      isFeatured: false,
    }))
  )
  return prefix
}

/**
 * Counts SQL queries while `run` executes.
 */
async function countQueries(run: () => Promise<unknown>) {
  const knex = db.connection().getWriteClient()
  let count = 0
  const listener = () => count++
  knex.on('query', listener)
  try {
    await run()
  } finally {
    knex.off('query', listener)
  }
  return count
}

test.group('Admin / list screen (FR-05)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('paginates 25 per page by default', async ({ client, assert }) => {
    const admin = await createUser('admin')
    const prefix = await createCatalog(30)
    const response = await client
      .get(`/admin/resources/products?search=${prefix}`)
      .loginAs(admin)
      .withInertia()

    response.assertStatus(200)
    const { list } = response.body().props
    assert.lengthOf(list.rows, 25)
    assert.deepEqual(list.meta, { total: 30, perPage: 25, currentPage: 1, lastPage: 2 })
    assert.equal(list.defaultPerPage, 25)
  })

  test('accepts the page sizes 10, 25, 50 and 100, and ignores others', async ({
    client,
    assert,
  }) => {
    const admin = await createUser('admin')
    const prefix = await createCatalog(12)

    for (const [perPage, expected] of [
      ['10', 10],
      ['50', 50],
      ['100', 100],
      ['30', 25],
    ] as const) {
      const response = await client
        .get(`/admin/resources/products?search=${prefix}&perPage=${perPage}`)
        .loginAs(admin)
        .withInertia()
      assert.equal(response.body().props.list.state.perPage, expected)
    }

    const second = await client
      .get(`/admin/resources/products?search=${prefix}&perPage=10&page=2`)
      .loginAs(admin)
      .withInertia()
    assert.lengthOf(second.body().props.list.rows, 2)
  })

  test('a page past the end redirects to the last page, keeping the rest of the URL', async ({
    client,
  }) => {
    const admin = await createUser('admin')
    const prefix = await createCatalog(12)
    const response = await client
      .get(`/admin/resources/products?search=${prefix}&perPage=10&page=9`)
      .loginAs(admin)
      .redirects(0)

    response.assertStatus(302)
    response.assertHeader(
      'location',
      `/admin/resources/products?search=${prefix}&perPage=10&page=2`
    )
  })

  test('sorts by a sortable column, both ways, with decimals in numeric order', async ({
    client,
    assert,
  }) => {
    const admin = await createUser('admin')
    const prefix = await createCatalog(12)
    const names = async (query: string) => {
      const response = await client
        .get(`/admin/resources/products?search=${prefix}&perPage=100&${query}`)
        .loginAs(admin)
        .withInertia()
      return response
        .body()
        .props.list.rows.map((row: { title: string }) => row.title.split(' ').pop())
    }

    // 10.00 sorts after 9.00 numerically, before it as text
    const byPrice = await names('sort=price&direction=asc')
    const byPriceDesc = await names('sort=price&direction=desc')
    const byNameDesc = await names('sort=name&direction=desc')

    assert.deepEqual(byPrice.slice(8, 11), ['09', '10', '11'])
    assert.deepEqual(byPriceDesc.slice(0, 3), ['12', '11', '10'])
    assert.deepEqual(byNameDesc.slice(0, 2), ['12', '11'])
  })

  test('ignores sorting by a column that is not sortable', async ({ client, assert }) => {
    const admin = await createUser('admin')
    const prefix = await createCatalog(3)
    const response = await client
      .get(`/admin/resources/products?search=${prefix}&sort=stock&direction=desc`)
      .loginAs(admin)
      .withInertia()

    response.assertStatus(200)
    assert.include(response.body().props.list.state, { sort: null, direction: 'asc' })
  })

  test('searches the search columns, case-insensitively', async ({ client, assert }) => {
    const admin = await createUser('admin')
    const prefix = await createCatalog(12)
    const search = async (term: string) => {
      const response = await client
        .get(`/admin/resources/products?search=${encodeURIComponent(term)}`)
        .loginAs(admin)
        .withInertia()
      return response.body().props.list.meta.total as number
    }

    assert.equal(await search(`${prefix} ITEM 1`), 3) // 10, 11, 12
    assert.equal(await search(`${prefix.toUpperCase()}-7`), 1) // by SKU
    assert.equal(await search(`${prefix} nothing`), 0)
  })

  test('partial reloads return only the list', async ({ client, assert }) => {
    const admin = await createUser('admin')
    const prefix = await createCatalog(3)
    const response = await client
      .get(`/admin/resources/products?search=${prefix}&sort=name&direction=desc`)
      .loginAs(admin)
      .withInertiaPartialReload('azu/resource/index' as never, ['list'] as never)

    response.assertStatus(200)
    const props = response.body().props
    assert.properties(props, ['list'])
    assert.notProperty(props, 'resource')
    assert.notProperty(props, 'azu')
    assert.include(props.list.state, { sort: 'name', direction: 'desc', search: prefix })
  })

  test('cells are plain JSON by column kind, with decimals as exact strings', async ({
    client,
    assert,
  }) => {
    const admin = await createUser('admin')
    const prefix = await createCatalog(1)
    const response = await client
      .get(`/admin/resources/products?search=${prefix}`)
      .loginAs(admin)
      .withInertia()
    const [row] = response.body().props.list.rows

    assert.equal(row.title, `${prefix} item 01`)
    assert.equal(row.cells.name, `${prefix} item 01`)
    assert.isString(row.cells.price)
    assert.equal(Number(row.cells.price), 1) // '1.00' on Postgres, '1' on SQLite
    assert.deepEqual(row.cells.thumbnail, { url: null })
    assert.equal(row.cells.status, 'draft')
    assert.deepInclude(row.cells.category, { title: `${prefix} cat 0` })
  })

  test('datetime cells are ISO strings', async ({ client, assert }) => {
    const admin = await createUser('admin')
    const customer = await createUser('customer')
    const number = `T-${randomUUID().slice(0, 8)}`
    await Order.create({
      userId: customer.id,
      number,
      status: 'paid',
      total: '99.50',
      placedAt: DateTime.fromISO('2026-10-25T00:30:00Z'),
    })
    const response = await client
      .get(`/admin/resources/orders?search=${number}`)
      .loginAs(admin)
      .withInertia()
    const [row] = response.body().props.list.rows

    assert.equal(new Date(row.cells.placedAt).toISOString(), '2026-10-25T00:30:00.000Z')
    assert.deepInclude(row.cells.user, { title: customer.email })
  })

  test('relations shown in columns are preloaded: no N+1', async ({ client, assert }) => {
    const admin = await createUser('admin')
    const few = await createCatalog(5, 5)
    const many = await createCatalog(25, 25)
    const list = (prefix: string) =>
      client.get(`/admin/resources/products?search=${prefix}`).loginAs(admin).withInertia()

    let rows: { cells: { category: { title: string | null } | null } }[] = []
    const fewQueries = await countQueries(() => list(few))
    const manyQueries = await countQueries(async () => {
      const response = await list(many)
      rows = response.body().props.list.rows
    })

    // Every row's category is there: Lucid never lazy-loads, so a missing
    // preload shows up as empty cells rather than extra queries
    assert.lengthOf(rows, 25)
    assert.isTrue(rows.every((row) => row.cells.category?.title?.startsWith(many)))

    // 5 rows in 5 categories, then 25 rows in 25 categories: the same
    // number of queries, so related rows aren't loaded one at a time
    assert.equal(manyQueries, fewQueries)
    assert.isAtMost(fewQueries, 6)
  })
})
