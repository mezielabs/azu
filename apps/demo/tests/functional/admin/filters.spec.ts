import { randomUUID } from 'node:crypto'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import type { AzuConfig } from '@mezielabs/azu'
import { DateTime } from 'luxon'
import Category from '#models/category'
import Coupon from '#models/coupon'
import Order from '#models/order'
import Product from '#models/product'
import { createUser } from './helpers.ts'

const PRODUCTS = '/admin/resources/products'
const unique = () => randomUUID().slice(0, 8).toUpperCase()

/**
 * Products named with a shared prefix, so each test's list is scoped
 * by search to its own rows (and filters combine with search).
 */
async function catalog() {
  const prefix = `F${unique()}`
  const kitchen = await Category.create({ name: `Kitchen ${prefix}`, slug: `k-${prefix}` })
  const books = await Category.create({ name: `Books ${prefix}`, slug: `b-${prefix}` })
  const make = (name: string, overrides: Partial<Product>) =>
    Product.create({
      categoryId: kitchen.id,
      name: `${prefix} ${name}`,
      sku: `${prefix}-${name}`,
      price: '10.00',
      stock: 20,
      status: 'draft',
      isFeatured: false,
      ...overrides,
    })
  const products = {
    pot: await make('pot', { status: 'published', price: '30.00', isFeatured: true }),
    pan: await make('pan', { status: 'published', price: '20.00', stock: 3 }),
    novel: await make('novel', { categoryId: books.id, price: '15.00' }),
    atlas: await make('atlas', { categoryId: books.id, status: 'published', stock: 2 }),
  }
  return { prefix, kitchen, books, products }
}

function names(response: { body(): any }, prefix: string) {
  return response
    .body()
    .props.list.rows.map((row: { title: string }) => row.title.replace(`${prefix} `, ''))
}

test.group('Admin / filters (FR-13)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('select, boolean, belongsTo and custom filters narrow the list', async ({
    client,
    assert,
  }) => {
    const admin = await createUser('admin')
    const { prefix, books } = await catalog()
    const list = (query: string) =>
      client.get(`${PRODUCTS}?search=${prefix}&sort=name&${query}`).loginAs(admin).withInertia()

    assert.deepEqual(names(await list('status=published'), prefix), ['atlas', 'pan', 'pot'])
    assert.deepEqual(names(await list('isFeatured=true'), prefix), ['pot'])
    assert.deepEqual(names(await list('isFeatured=false'), prefix), ['atlas', 'novel', 'pan'])
    assert.deepEqual(names(await list(`category=${books.id}`), prefix), ['atlas', 'novel'])
    assert.deepEqual(names(await list('low-stock=1'), prefix), ['atlas', 'pan'])
    // They combine with each other, with search and with sort
    assert.deepEqual(
      names(await list(`category=${books.id}&status=published&low-stock=1`), prefix),
      ['atlas']
    )
  })

  test('filters combine with a sort, and the state comes back in props', async ({
    client,
    assert,
  }) => {
    const admin = await createUser('admin')
    const { prefix, kitchen } = await catalog()

    const response = await client
      .get(
        `${PRODUCTS}?search=${prefix}&status=published&category=${kitchen.id}&sort=price&direction=desc`
      )
      .loginAs(admin)
      .withInertia()

    assert.deepEqual(names(response, prefix), ['pot', 'pan'])
    const { state, filters } = response.body().props.list
    assert.deepEqual(state.filters, { status: 'published', category: String(kitchen.id) })
    const category = filters.find((item: { name: string }) => item.name === 'category')
    assert.containsSubset(category, {
      kind: 'belongsTo',
      value: String(kitchen.id),
      selected: { id: kitchen.id, title: kitchen.name },
      optionsUrl: '/admin/resources/products/filters/category/options',
    })
  })

  test('values that do not fit their filter are ignored, not errors', async ({
    client,
    assert,
  }) => {
    const admin = await createUser('admin')
    const { prefix } = await catalog()

    for (const query of [
      'status=archived',
      'isFeatured=yes',
      'createdAt=2026-02-30..',
      'category=2147483000',
      'category=abc',
      'low-stock=0',
    ]) {
      const response = await client
        .get(`${PRODUCTS}?search=${prefix}&${query}`)
        .loginAs(admin)
        .withInertia()
      response.assertStatus(200)
      assert.lengthOf(response.body().props.list.rows, 4, query)
      assert.deepEqual(response.body().props.list.state.filters, {}, query)
    }
  })

  test('a bookmarked filtered URL past the last page keeps its filters', async ({ client }) => {
    const admin = await createUser('admin')
    const { prefix } = await catalog()

    const response = await client
      .get(`${PRODUCTS}?search=${prefix}&status=published&page=9`)
      .loginAs(admin)
      .redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', `${PRODUCTS}?search=${prefix}&status=published`)
  })

  test('forbidden: staff get no category filter, and its parameter is ignored', async ({
    client,
    assert,
  }) => {
    // Staff can list products but not categories (CategoryPolicy.viewList)
    const staff = await createUser('staff')
    const { prefix, books } = await catalog()

    const response = await client
      .get(`${PRODUCTS}?search=${prefix}&category=${books.id}`)
      .loginAs(staff)
      .withInertia()

    const { filters, rows, state } = response.body().props.list
    assert.notInclude(
      filters.map((item: { name: string }) => item.name),
      'category'
    )
    assert.deepEqual(state.filters, {})
    assert.lengthOf(rows, 4)
  })

  test('a belongsTo filter reuses the options query and its viewList rule', async ({
    client,
    assert,
  }) => {
    const [admin, staff] = [await createUser('admin'), await createUser('staff')]
    const { prefix, books } = await catalog()
    const options = `${PRODUCTS}/filters/category/options?search=${encodeURIComponent(`Books ${prefix}`)}`

    const asAdmin = await client.get(options).loginAs(admin)
    asAdmin.assertStatus(200)
    assert.deepEqual(asAdmin.body(), { options: [{ id: books.id, title: books.name }] })

    // forbidden: the related resource's viewList (CategoryPolicy)
    const asStaff = await client.get(options).loginAs(staff)
    asStaff.assertStatus(403)

    // forbidden: the resource's own viewList (OrderPolicy), checked first
    const orders = await client.get('/admin/resources/orders/filters/status/options').loginAs(staff)
    orders.assertStatus(403)

    // Only belongsTo filters have options
    for (const path of ['filters/status/options', 'filters/nope/options']) {
      const response = await client.get(`${PRODUCTS}/${path}`).loginAs(admin)
      response.assertStatus(404)
    }
  })

  test('a date range on a date column compares dates (Coupon.startsOn)', async ({
    client,
    assert,
  }) => {
    const admin = await createUser('admin')
    const code = `D${unique()}`
    for (const [suffix, startsOn] of [
      ['A', '2026-09-30'],
      ['B', '2026-10-01'],
      ['C', '2026-10-31'],
      ['D', '2026-11-01'],
    ]) {
      await Coupon.create({
        code: `${code}${suffix}`,
        kind: 'percent',
        amount: '5.00',
        currency: 'NGN',
        isActive: suffix !== 'D',
        startsOn: DateTime.fromISO(startsOn),
      })
    }
    const list = async (query: string) => {
      const response = await client
        .get(`/admin/resources/coupons?search=${code}&sort=code&${query}`)
        .loginAs(admin)
        .withInertia()
      return response
        .body()
        .props.list.rows.map((row: { title: string }) => row.title.replace(code, ''))
    }

    assert.deepEqual(await list('startsOn=2026-10-01..2026-10-31'), ['B', 'C'])
    assert.deepEqual(await list('startsOn=2026-10-31..'), ['C', 'D'])
    assert.deepEqual(await list('startsOn=..2026-09-30'), ['A'])
    assert.deepEqual(await list('startsOn=2026-10-01..&isActive=false'), ['D'])
  })
})

/**
 * The server process runs in UTC (`TZ=UTC` in .env.test); the admin's
 * timezone is Africa/Lagos (UTC+1). A day in a date range is a day in
 * the admin's timezone.
 */
test.group('Admin / date range filters in the admin timezone (FR-13)', (group) => {
  const config = app.config.get<AzuConfig>('admin')
  const original = config.timezone

  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.teardown(() => {
    config.timezone = original
  })

  test('an order is on the day it was placed in Lagos', async ({ client, assert }) => {
    config.timezone = 'Africa/Lagos'
    const admin = await createUser('admin')
    const customer = await createUser('customer')
    const prefix = `T${unique()}`
    for (const [suffix, placedAt] of [
      ['late-4th', '2026-10-04T22:59:00Z'], // 23:59 on the 4th in Lagos
      ['early-5th', '2026-10-04T23:30:00Z'], // 00:30 on the 5th in Lagos
      ['late-5th', '2026-10-05T22:59:00Z'], // 23:59 on the 5th
      ['early-6th', '2026-10-05T23:00:00Z'], // midnight, the 6th
    ]) {
      await Order.create({
        userId: customer.id,
        number: `${prefix}-${suffix}`,
        status: 'paid',
        total: '10.00',
        placedAt: DateTime.fromISO(placedAt),
      })
    }
    const list = async (range: string) => {
      const response = await client
        .get(`/admin/resources/orders?search=${prefix}&sort=placedAt&placedAt=${range}`)
        .loginAs(admin)
        .withInertia()
      return response
        .body()
        .props.list.rows.map((row: { title: string }) => row.title.replace(`${prefix}-`, ''))
    }

    assert.deepEqual(await list('2026-10-05..2026-10-05'), ['early-5th', 'late-5th'])
    assert.deepEqual(await list('..2026-10-04'), ['late-4th'])
    assert.deepEqual(await list('2026-10-06..'), ['early-6th'])
  })
})
