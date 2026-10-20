import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { column, defineResource, defineScreen, metric } from '@mezielabs/azu'
import type { AzuConfig } from '@mezielabs/azu/types'
import { DateTime } from 'luxon'
import { accessAdmin } from '#abilities/main'
import orders from '#admin/resources/order_resource'
import Order from '#models/order'
import OrderPolicy from '#policies/order_policy'
import { createUser, withScreen } from './helpers.ts'

/** The Overview's trend (app/admin/screens/overview.ts) */
const TREND = 'widget4'

let sequence = 0

function placeOrder(userId: number, status: string, total: string, placedAt: DateTime) {
  sequence++
  return Order.create({
    userId,
    number: `T-${sequence}-${Date.now()}`,
    status: status as Order['status'],
    total,
    // In the server's zone, as a form save stores it
    placedAt: placedAt.toLocal(),
  })
}

async function trendOf(client: any, user: any, url: string, key = TREND) {
  const response = await client
    .get(url)
    .loginAs(user)
    .withInertiaPartialReload('azu/screen', [key] as never)
  response.assertStatus(200)
  return response.body().props[key]
}

/** A one-trend screen, for one test */
async function trendScreen(
  name: string,
  trend: any,
  cleanup: (callback: () => void) => void,
  ranges: ('7d' | '30d' | 'today')[] = ['7d']
) {
  await withScreen(
    name,
    defineScreen({ label: 'Trend', ability: accessAdmin, ranges, widgets: [trend] }),
    cleanup
  )
  return `/admin/screens/${name}`
}

/**
 * Trend widgets (FR-25): buckets in the admin's timezone, one query
 */
test.group('Admin / trends (FR-25)', (group) => {
  const config = app.config.get<AzuConfig>('azu')
  const original = config.timezone

  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.teardown(() => {
    config.timezone = original
  })

  test('the Overview trend: one bucket per day, empty ones 0, exact sums', async ({
    client,
    assert,
  }) => {
    const admin = await createUser('admin')
    const customer = await createUser('customer')
    const midnight = DateTime.now().startOf('day')
    // Sold today and two days ago (twice); pending and cancelled don't count
    await placeOrder(customer.id, 'paid', '1500.25', midnight.plus({ minutes: 1 }))
    await placeOrder(
      customer.id,
      'shipped',
      '1000.10',
      midnight.minus({ days: 2 }).plus({ hours: 9 })
    )
    await placeOrder(customer.id, 'paid', '0.20', midnight.minus({ days: 2 }).plus({ hours: 15 }))
    await placeOrder(
      customer.id,
      'pending',
      '999.00',
      midnight.minus({ days: 1 }).plus({ hours: 9 })
    )
    await placeOrder(customer.id, 'cancelled', '999.00', midnight.minus({ hours: 2 }))

    const trend = await trendOf(client, admin, '/admin?range=7d')
    assert.include(trend, { status: 'ok', kind: 'trend', unit: 'day', chart: 'line' })
    assert.lengthOf(trend.buckets, 7)
    assert.deepEqual(
      trend.buckets.map((bucket: { value: string }) => bucket.value),
      ['0.00', '0.00', '0.00', '0.00', '1000.30', '0.00', '1500.25']
    )
    assert.equal(trend.total, '2500.55')
    assert.equal(trend.noun, 'orders')
    // Each day links to the list filtered to it
    const today = midnight.toISODate()
    assert.equal(trend.buckets[6].href, `/admin/resources/orders?placedAt=${today}..${today}`)
  })

  test('an order at 23:30 in Lagos counts on that Lagos day, not the UTC one', async ({
    client,
    assert,
    cleanup,
  }) => {
    config.timezone = 'Africa/Lagos'
    const customer = await createUser('customer')
    const midnight = DateTime.now().setZone('Africa/Lagos').startOf('day')
    // 23:30 yesterday in Lagos; and 00:30 today, which is still yesterday in UTC
    await placeOrder(customer.id, 'paid', '10.00', midnight.minus({ minutes: 30 }))
    await placeOrder(customer.id, 'paid', '20.00', midnight.plus({ minutes: 1 }))
    const url = await trendScreen(
      'zz-lagos',
      metric.trend('Revenue').sum(orders, 'total').date('placedAt'),
      cleanup
    )
    const admin = await createUser('admin')
    const trend = await trendOf(client, admin, url, 'widget0')
    assert.equal(trend.buckets[6].start.slice(0, 10), midnight.toISODate())
    assert.equal(trend.buckets[6].value, '20.00')
    assert.equal(trend.buckets[5].value, '10.00')
  })

  test('a scoped query hook changes the buckets', async ({ client, assert, cleanup }) => {
    const mine = await createUser('customer')
    const other = await createUser('customer')
    const midnight = DateTime.now().startOf('day')
    await placeOrder(mine.id, 'paid', '100.00', midnight.minus({ days: 1 }).plus({ hours: 10 }))
    await placeOrder(other.id, 'paid', '250.50', midnight.minus({ days: 1 }).plus({ hours: 11 }))
    const scoped = defineResource(Order, {
      policy: OrderPolicy,
      query: (query) => query.where('userId', mine.id),
      columns: [column.decimal('total')],
    })
    const url = await trendScreen(
      'zz-scoped-trend',
      metric.trend('Mine').sum(scoped, 'total').date('placedAt'),
      cleanup
    )
    const admin = await createUser('admin')
    const trend = await trendOf(client, admin, url, 'widget0')
    assert.equal(trend.buckets[5].value, '100.00')
    assert.equal(trend.total, '100.00')
  })

  test('compare(): the previous period, bucket for bucket', async ({ client, assert, cleanup }) => {
    const customer = await createUser('customer')
    const midnight = DateTime.now().startOf('day')
    // Yesterday, and the same day a week earlier; three days ago, and a week before that
    await placeOrder(customer.id, 'paid', '5.00', midnight.minus({ days: 1 }).plus({ hours: 8 }))
    await placeOrder(customer.id, 'paid', '7.00', midnight.minus({ days: 8 }).plus({ hours: 8 }))
    await placeOrder(customer.id, 'paid', '3.00', midnight.minus({ days: 10 }).plus({ hours: 8 }))
    const url = await trendScreen(
      'zz-compare-trend',
      metric.trend('Orders').count(orders).date('placedAt').compare().bars(),
      cleanup
    )
    const admin = await createUser('admin')
    const page = await client.get(url).loginAs(admin).withInertia()
    assert.include(page.body().props.widgets[0], { kind: 'trend', compares: true, width: 4 })
    const trend = await trendOf(client, admin, url, 'widget0')
    assert.equal(trend.chart, 'bars')
    assert.deepEqual(
      trend.buckets.map((bucket: { value: string; previous: string }) => [
        bucket.value,
        bucket.previous,
      ]),
      [
        ['0', '0'],
        ['0', '0'],
        ['0', '0'],
        ['0', '1'],
        ['0', '0'],
        ['1', '1'],
        ['0', '0'],
      ]
    )
    assert.equal(trend.previousTotal, '2')
  })

  test("a user without the resource's viewList gets no trend", async ({ client, assert }) => {
    const staff = await createUser('staff')
    const page = await client.get('/admin').loginAs(staff).withInertia()
    assert.notInclude(
      page.body().props.widgets.map((item: { key: string }) => item.key),
      TREND
    )
    const response = await client
      .get('/admin')
      .loginAs(staff)
      .withInertiaPartialReload('azu/screen', [TREND] as never)
    assert.notProperty(response.body().props, TREND)
  })

  test('hours today; months this year', async ({ client, assert }) => {
    const admin = await createUser('admin')
    const today = await trendOf(client, admin, '/admin?range=today')
    assert.equal(today.unit, 'hour')
    assert.equal(today.buckets.length, DateTime.now().hour + 1)
    assert.isTrue(today.buckets.every((bucket: { href: string | null }) => bucket.href === null))
    const year = await trendOf(client, admin, '/admin?range=year')
    assert.equal(year.unit, 'month')
    assert.equal(year.buckets.length, DateTime.now().month)
  })
})
