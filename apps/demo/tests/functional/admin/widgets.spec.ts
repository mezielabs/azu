import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { column, defineResource, defineScreen, metric } from '@mezielabs/azu'
import type { AzuConfig } from '@mezielabs/azu/types'
import { DateTime } from 'luxon'
import { accessAdmin } from '#abilities/main'
import orders from '#admin/resources/order_resource'
import Category from '#models/category'
import Order from '#models/order'
import Product from '#models/product'
import OrderPolicy from '#policies/order_policy'
import { createUser, withScreen } from './helpers.ts'

/** The Overview's widgets, in order (app/admin/screens/overview.ts) */
const KEYS = {
  revenue: 'widget0',
  orders: 'widget1',
  average: 'widget2',
  customers: 'widget3',
  cancelled: 'widget4',
  goal: 'widget5',
  status: 'widget6',
  recent: 'widget7',
  lowStock: 'widget8',
}

let sequence = 0

async function placeOrder(
  userId: number,
  status: 'pending' | 'paid' | 'shipped' | 'cancelled',
  total: string,
  placedAt: DateTime
) {
  sequence++
  // In the server's zone, as a form save stores it
  return Order.create({
    userId,
    number: `W-${sequence}-${Date.now()}`,
    status,
    total,
    placedAt: placedAt.toLocal(),
  })
}

/** One widget's data, through a partial reload, as the client loads it */
async function widget(client: any, user: any, key: string, url = '/admin') {
  const response = await client
    .get(url)
    .loginAs(user)
    .withInertiaPartialReload('azu/screen', [key] as never)
  response.assertStatus(200)
  return response.body().props
}

/** One widget's data, through a partial reload */
async function widgetOf(client: any, user: any, key: string, url = '/admin') {
  const props = await widget(client, user, key, url)
  return props[key]
}

/** A page's props, from an Inertia visit */
async function pageProps(client: any, user: any, url: string) {
  const response = await client.get(url).loginAs(user).withInertia()
  return response.body().props
}

/**
 * Widgets on screens (FR-24), through the demo's Overview
 */
test.group('Admin / widgets (FR-24)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('partition averages and extrema aggregate omitted records with scope and range intact', async ({
    client,
    assert,
    cleanup,
  }) => {
    const admin = await createUser('admin')
    const customer = await createUser('customer')
    const other = await createUser('customer')
    const now = DateTime.now().minus({ hours: 1 })
    for (const [status, value] of [
      ['paid', '100.00'],
      ['pending', '20.00'],
      ['cancelled', '10.00'],
      ['cancelled', '10.00'],
    ] as const) {
      await placeOrder(customer.id, status, value, now)
    }
    await placeOrder(other.id, 'paid', '999.00', now)
    await placeOrder(customer.id, 'paid', '999.00', now.minus({ days: 400 }))
    await placeOrder(customer.id, 'shipped', '999.00', now)
    const scoped = defineResource(Order, {
      policy: OrderPolicy,
      query: (query) => query.where('userId', customer.id),
      columns: [column.decimal('total')],
    })
    await withScreen(
      'partition-aggregates',
      defineScreen({
        label: 'Aggregates',
        ability: accessAdmin,
        widgets: (['avg', 'min', 'max'] as const).map((operation) =>
          metric
            .partition(operation)
            [operation](scoped, 'total')
            .groupBy('status')
            .limit(1)
            .date('placedAt')
            .where((query) => query.whereNot('status', 'shipped'))
        ),
      }),
      cleanup
    )
    for (const [index, total, omitted] of [
      [0, '35.00', '13.33'],
      [1, '10.00', '10.00'],
      [2, '100.00', '20.00'],
    ] as const) {
      const data = await widgetOf(
        client,
        admin,
        `widget${index}`,
        '/admin/screens/partition-aggregates'
      )
      assert.equal(data.total, total)
      assert.equal(data.rows[0].value, '100.00')
      assert.equal(data.rows[1].label, 'Other')
      assert.equal(data.rows[1].value, omitted)
      assert.equal(data.rows[1].share, Number(omitted) / 100)
      assert.isNull(data.rows[1].href)
      for (const row of data.rows) assert.isNull(row.percent)
    }
  })

  test('Other includes null grouping keys for non-additive partitions', async ({
    client,
    assert,
    cleanup,
  }) => {
    const admin = await createUser('admin')
    const customer = await createUser('customer')
    const now = DateTime.now().minus({ hours: 1 })
    const top = await placeOrder(customer.id, 'paid', '100.00', now)
    const bottom = await placeOrder(customer.id, 'pending', '10.00', now)
    await Order.query().where('id', bottom.id).update({ updatedAt: null })
    await withScreen(
      'null-partition',
      defineScreen({
        label: 'Null keys',
        ability: accessAdmin,
        widgets: [metric.partition('Average').avg(orders, 'total').groupBy('updatedAt').limit(1)],
      }),
      cleanup
    )
    const data = await widgetOf(client, admin, 'widget0', '/admin/screens/null-partition')
    assert.equal(data.total, '55.00')
    assert.equal(data.rows[0].value, top.total)
    assert.equal(data.rows[1].value, '10.00')
  })

  test('the page lists the widgets and the range; their data loads separately', async ({
    client,
    assert,
  }) => {
    const admin = await createUser('admin')
    const response = await client.get('/admin').loginAs(admin).withInertia()
    response.assertStatus(200)
    const page = response.body()
    const { props } = page
    assert.include(props.screen, { name: 'overview', component: null, widgets: true })
    assert.deepEqual(
      props.widgets.map((item: { key: string; kind: string; width: number }) => [
        item.key,
        item.kind,
        item.width,
      ]),
      [
        ['widget0', 'value', 1],
        ['widget1', 'value', 1],
        ['widget2', 'value', 1],
        ['widget3', 'value', 1],
        ['widget4', 'value', 1],
        ['widget5', 'progress', 1],
        ['widget6', 'partition', 2],
        ['widget7', 'table', 2],
        ['widget8', 'table', 2],
      ]
    )
    assert.deepEqual(props.ranges, ['30d', 'today', '7d', 'month'])
    assert.equal(props.range.name, '30d')
    // Deferred: none of the widgets' data is in the first response, and
    // each is in its own group, so each loads in its own request
    for (const key of Object.values(KEYS)) assert.notProperty(props, key)
    assert.deepEqual(
      page.deferredProps,
      Object.fromEntries(Object.values(KEYS).map((key) => [key, [key]]))
    )
  })

  test('values: totals, averages, counts and comparisons, exact', async ({ client, assert }) => {
    const admin = await createUser('admin')
    const customer = await createUser('customer')
    const now = DateTime.now()
    await placeOrder(customer.id, 'paid', '1500.25', now.minus({ hours: 1 }))
    await placeOrder(customer.id, 'shipped', '2499.75', now.minus({ days: 2 }))
    await placeOrder(customer.id, 'pending', '1000.00', now.minus({ days: 3 }))
    await placeOrder(customer.id, 'cancelled', '500.00', now.minus({ days: 1 }))
    // The 30 days before
    await placeOrder(customer.id, 'paid', '999.99', now.minus({ days: 40 }))

    const revenue = await widget(client, admin, KEYS.revenue)
    assert.notProperty(revenue, 'azu')
    const { range } = await pageProps(client, admin, '/admin')
    assert.deepEqual(revenue[KEYS.revenue], {
      status: 'ok',
      kind: 'value',
      value: '4000.00',
      previous: '999.99',
      comparison: { kind: 'change', direction: 'up', percent: '300.0%', outcome: 'better' },
      // The range only: no list filter says "paid or shipped" (the where())
      href: `/admin/resources/orders?placedAt=${range.from}..${range.to}`,
    })

    const count = await widget(client, admin, KEYS.orders)
    assert.include(count[KEYS.orders], { value: '4', previous: '1' })
    assert.equal(
      count[KEYS.orders].href,
      `/admin/resources/orders?placedAt=${range.from}..${range.to}`
    )

    // (1500.25 + 2499.75) / 2, at the column's scale
    const average = await widget(client, admin, KEYS.average)
    assert.include(average[KEYS.average], { value: '2000.00', previous: '999.99', href: null })

    // createUser made one customer in range, none before: "New"
    const customers = await widget(client, admin, KEYS.customers)
    assert.include(customers[KEYS.customers], { value: '1', previous: '0' })
    assert.deepEqual(customers[KEYS.customers].comparison, { kind: 'new' })

    // Lower is better: 1 cancelled now against 0 before is still just "New"
    const cancelled = await widgetOf(client, admin, KEYS.cancelled)
    assert.include(cancelled, { value: '1', previous: '0' })
    assert.deepEqual(cancelled.comparison, { kind: 'new' })
    assert.equal(
      cancelled.href,
      `/admin/resources/orders?placedAt=${range.from}..${range.to}&status=cancelled`
    )
  })

  test('progress against its goal, month to date, whatever the range', async ({
    client,
    assert,
  }) => {
    const admin = await createUser('admin')
    const customer = await createUser('customer')
    const now = DateTime.now()
    const month = now.startOf('month')
    await placeOrder(customer.id, 'paid', '75000.00', now.minus({ minutes: 5 }))
    await placeOrder(customer.id, 'pending', '1000.00', now.minus({ minutes: 5 }))
    // Last month: not counted
    await placeOrder(customer.id, 'paid', '50000.00', month.minus({ days: 2 }))

    for (const url of ['/admin', '/admin?range=today']) {
      const props = await widget(client, admin, KEYS.goal, url)
      const goal = props[KEYS.goal]
      assert.include(goal, { kind: 'progress', value: '75000.00', goal: '750000', share: 0.1 })
      assert.equal(goal.period, month.setLocale('en').toFormat('LLLL yyyy'))
      assert.isAbove(goal.pace, 0)
      assert.isAtMost(goal.pace, 1)
      assert.isAbove(goal.remaining, 0)
    }
  })

  test('partition rows are labelled from the select filter and link to the filtered list', async ({
    client,
    assert,
  }) => {
    const admin = await createUser('admin')
    const customer = await createUser('customer')
    const now = DateTime.now()
    await placeOrder(customer.id, 'paid', '10.00', now.minus({ hours: 1 }))
    await placeOrder(customer.id, 'paid', '20.00', now.minus({ hours: 2 }))
    await placeOrder(customer.id, 'shipped', '30.00', now.minus({ hours: 3 }))
    // Outside the range
    await placeOrder(customer.id, 'pending', '40.00', now.minus({ days: 45 }))

    const props = await widget(client, admin, KEYS.status, '/admin?range=7d')
    const { range } = await pageProps(client, admin, '/admin?range=7d')
    const data = props[KEYS.status]
    assert.equal(data.total, '3')
    assert.deepEqual(data.unit, { one: 'order', other: 'orders' })
    assert.deepEqual(
      data.rows.map((row: { label: string; value: string; href: string }) => [
        row.label,
        row.value,
        row.href,
      ]),
      [
        ['Paid', '2', `/admin/resources/orders?placedAt=${range.from}..${range.to}&status=paid`],
        [
          'Shipped',
          '1',
          `/admin/resources/orders?placedAt=${range.from}..${range.to}&status=shipped`,
        ],
      ]
    )
  })

  test('cancellations: fewer than before is better, more is worse', async ({ client, assert }) => {
    const admin = await createUser('admin')
    const customer = await createUser('customer')
    const now = DateTime.now()
    // 1 in the last 30 days, 3 in the 30 days before
    await placeOrder(customer.id, 'cancelled', '10.00', now.minus({ days: 1 }))
    for (const days of [35, 40, 45]) {
      await placeOrder(customer.id, 'cancelled', '10.00', now.minus({ days }))
    }
    const page = await pageProps(client, admin, '/admin')
    const schema = page.widgets.find((item: { key: string }) => item.key === KEYS.cancelled)
    assert.include(schema, { label: 'Cancelled orders', better: 'lower', compares: true })
    const fewer = await widgetOf(client, admin, KEYS.cancelled)
    assert.deepEqual(fewer.comparison, {
      kind: 'change',
      direction: 'down',
      percent: '66.7%',
      outcome: 'better',
    })
    // Revenue on the same page is higher-is-better
    assert.equal(
      page.widgets.find((item: { key: string }) => item.key === KEYS.revenue).better,
      'higher'
    )
  })

  test("partition ties keep the select options' order, on every database", async ({
    client,
    assert,
  }) => {
    const admin = await createUser('admin')
    const customer = await createUser('customer')
    const now = DateTime.now()
    // Two of each: a four-way tie
    for (const status of ['cancelled', 'shipped', 'paid', 'pending'] as const) {
      for (let index = 0; index < 2; index++) {
        await placeOrder(customer.id, status, '10.00', now.minus({ hours: index + 1 }))
      }
    }
    // The orders resource's status filter lists pending, paid, shipped, cancelled
    for (let run = 0; run < 3; run++) {
      const data = await widgetOf(client, admin, KEYS.status)
      assert.deepEqual(
        data.rows.map((row: { label: string; value: string }) => `${row.label} ${row.value}`),
        ['Pending 2', 'Paid 2', 'Shipped 2', 'Cancelled 2']
      )
    }
  })

  test("tables use the resource's columns, preloads and per-row view checks", async ({
    client,
    assert,
  }) => {
    const admin = await createUser('admin')
    const customer = await createUser('customer')
    const now = DateTime.now()
    for (let index = 0; index < 7; index++) {
      await placeOrder(customer.id, 'paid', '10.00', now.minus({ hours: index + 1 }))
    }
    const recent = await widgetOf(client, admin, KEYS.recent)
    assert.equal(recent.resource, 'orders')
    assert.lengthOf(recent.rows, 5)
    assert.equal(recent.total, 7)
    assert.equal(recent.href, '/admin/resources/orders')
    // The demo's subset of the resource's columns
    assert.deepEqual(
      recent.columns.map((item: { name: string }) => item.name),
      ['number', 'status', 'total', 'placedAt']
    )
    // Newest first, through the resource's query hook and its preloads,
    // and a view check per row
    assert.equal(recent.rows[0].cells.user.title, customer.email)
    assert.isTrue(recent.rows.every((row: { abilities: { view: boolean } }) => row.abilities.view))

    const category = await Category.create({ name: 'Kitchen', slug: `kitchen-${Date.now()}` })
    for (const [name, stock] of [
      ['Pot', 2],
      ['Pan', 7],
      ['Bowl', 30],
    ] as const) {
      await Product.create({
        categoryId: category.id,
        name,
        sku: `W-${name}-${Date.now()}`,
        price: '10.00',
        stock,
        status: 'published',
        isFeatured: false,
      })
    }
    const lowStock = await widgetOf(client, admin, KEYS.lowStock)
    assert.deepEqual(
      lowStock.columns.map((item: { name: string }) => item.name),
      ['name', 'category', 'stock']
    )
    assert.deepEqual(
      lowStock.rows.map((row: { title: string }) => row.title),
      ['Pot', 'Pan']
    )
    assert.equal(lowStock.rows[0].cells.category.title, 'Kitchen')
    assert.equal(lowStock.href, '/admin/resources/products?low-stock=1')
  })

  test("staff get only the widgets they may see, and can't load the others", async ({
    client,
    assert,
  }) => {
    const staff = await createUser('staff')
    const response = await client.get('/admin').loginAs(staff).withInertia()
    // OrderPolicy's viewList and viewReports are admins only
    assert.deepEqual(
      response.body().props.widgets.map((item: { key: string }) => item.key),
      [KEYS.lowStock]
    )
    const forbidden = await widget(client, staff, KEYS.revenue)
    assert.notProperty(forbidden, KEYS.revenue)
  })

  test("every query starts from the resource's query hook", async ({ client, assert, cleanup }) => {
    const mine = await createUser('customer')
    const other = await createUser('customer')
    const now = DateTime.now()
    await placeOrder(mine.id, 'paid', '100.00', now.minus({ hours: 1 }))
    await placeOrder(other.id, 'paid', '250.50', now.minus({ hours: 1 }))
    // A resource scoped to one customer's orders, as a multi-tenant app might be
    const scoped = defineResource(Order, {
      policy: OrderPolicy,
      query: (query) => query.where('userId', mine.id),
      columns: [column.decimal('total')],
    })
    await withScreen(
      'zz-scoped',
      defineScreen({
        label: 'Scoped',
        ability: accessAdmin,
        widgets: [
          metric.value('All').sum(orders, 'total').date('placedAt'),
          metric.value('Mine').sum(scoped, 'total').date('placedAt'),
          metric.partition('Mine by status').count(scoped).groupBy('status'),
        ],
      }),
      cleanup
    )
    const admin = await createUser('admin')
    const url = '/admin/screens/zz-scoped'
    const [all, scopedTotal, byStatus] = [
      await widgetOf(client, admin, 'widget0', url),
      await widgetOf(client, admin, 'widget1', url),
      await widgetOf(client, admin, 'widget2', url),
    ]
    assert.equal(all.value, '350.50')
    assert.equal(scopedTotal.value, '100.00')
    assert.equal(byStatus.total, '1')
  })

  test('the range comes from ?range=, falling back to the default', async ({ client, assert }) => {
    const admin = await createUser('admin')
    const range = async (query: string) => {
      const props = await pageProps(client, admin, `/admin${query}`)
      return props.range.name
    }
    assert.equal(await range('?range=7d'), '7d')
    assert.equal(await range('?range=month'), 'month')
    // Not offered on this screen, or not a range at all
    assert.equal(await range('?range=90d'), '30d')
    assert.equal(await range('?range=bogus'), '30d')
  })

  test('comparisons: new, no change, and all-time widgets that ignore the range', async ({
    client,
    assert,
    cleanup,
  }) => {
    const customer = await createUser('customer')
    await placeOrder(customer.id, 'paid', '10.00', DateTime.now().minus({ hours: 1 }))
    await placeOrder(customer.id, 'paid', '10.00', DateTime.now().minus({ days: 400 }))
    await withScreen(
      'zz-compare',
      defineScreen({
        label: 'Compare',
        ability: accessAdmin,
        ranges: ['7d'],
        widgets: [
          metric.value('Paid').count(orders).date('placedAt'),
          metric
            .value('Shipped')
            .count(orders)
            .where((q) => q.where('status', 'shipped'))
            .date('placedAt'),
          metric.value('All time').count(orders),
          metric.value('No comparison').count(orders).date('placedAt').compare(false),
        ],
      }),
      cleanup
    )
    const admin = await createUser('admin')
    const url = '/admin/screens/zz-compare'
    const page = await pageProps(client, admin, url)
    assert.deepEqual(
      page.widgets.map((item: { note: string | null; compares: boolean }) => [
        item.note,
        item.compares,
      ]),
      [
        [null, true],
        [null, true],
        ['All time', false],
        [null, false],
      ]
    )
    const fresh = await widgetOf(client, admin, 'widget0', url)
    const flat = await widgetOf(client, admin, 'widget1', url)
    assert.deepEqual(fresh.comparison, {
      kind: 'new',
    })
    assert.deepEqual(flat.comparison, {
      kind: 'same',
    })
    assert.include(await widgetOf(client, admin, 'widget2', url), {
      value: '2',
      previous: null,
      comparison: null,
    })
    assert.include(await widgetOf(client, admin, 'widget3', url), {
      previous: null,
      comparison: null,
    })
  })

  test("a widget that throws shows as an error; the page and the other widgets don't", async ({
    client,
    assert,
    cleanup,
  }) => {
    await withScreen(
      'zz-broken',
      defineScreen({
        label: 'Broken',
        ability: accessAdmin,
        widgets: [
          // Throws while building its query. (Not invalid SQL: on Postgres
          // that would abort the test's global transaction for every
          // request after it, which a real request doesn't share.)
          metric
            .value('Broken')
            .count(orders)
            .where(() => {
              throw new Error('the warehouse is unreachable')
            }),
          metric.value('Fine').count(orders),
        ],
      }),
      cleanup
    )
    const admin = await createUser('admin')
    const url = '/admin/screens/zz-broken'
    const page = await client.get(url).loginAs(admin).withInertia()
    page.assertStatus(200)
    assert.deepEqual(await widgetOf(client, admin, 'widget0', url), { status: 'error' })
    assert.include(await widgetOf(client, admin, 'widget1', url), { status: 'ok' })
  })
})

test.group('Admin / widget ranges in the admin timezone (FR-24)', (group) => {
  const config = app.config.get<AzuConfig>('azu')
  const original = config.timezone

  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.teardown(() => {
    config.timezone = original
  })

  test("an order counts on the admin's day, not the server's (UTC)", async ({
    client,
    assert,
    cleanup,
  }) => {
    config.timezone = 'Africa/Lagos'
    const customer = await createUser('customer')
    const midnight = DateTime.now().setZone('Africa/Lagos').startOf('day')
    // A minute after midnight in Lagos: 23:01 the day before in UTC
    await placeOrder(customer.id, 'paid', '10.00', midnight.plus({ minutes: 1 }))
    // 23:30 yesterday in Lagos (22:30 UTC): yesterday either way
    await placeOrder(customer.id, 'paid', '20.00', midnight.minus({ minutes: 30 }))
    await withScreen(
      'zz-today',
      defineScreen({
        label: 'Today',
        ability: accessAdmin,
        ranges: ['today'],
        widgets: [metric.value('Revenue').sum(orders, 'total').date('placedAt')],
      }),
      cleanup
    )
    const admin = await createUser('admin')
    const data = await widgetOf(client, admin, 'widget0', '/admin/screens/zz-today')
    assert.include(data, { value: '10.00' })
    const { range } = await pageProps(client, admin, '/admin/screens/zz-today')
    assert.equal(range.from, midnight.toISODate())
    assert.equal(range.timezone, 'Africa/Lagos')
  })
})
