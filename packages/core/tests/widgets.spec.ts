import { test } from '@japa/runner'
import { Logger } from '@adonisjs/core/logger'
import type { HttpContext } from '@adonisjs/core/http'
import { Bouncer } from '@adonisjs/bouncer'
import { Database } from '@adonisjs/lucid/database'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import { checkWidgets } from '../src/doctor/checks.ts'
import { column as listColumn } from '../src/resources/columns.ts'
import { defineResource } from '../src/resources/define_resource.ts'
import { filter } from '../src/resources/filters.ts'
import { defineScreen } from '../src/screens/define_screen.ts'
import {
  compareValues,
  comparisonText,
  parseRange,
  percentOf,
  rangeSummary,
  timeLeft,
  withRange,
} from '../src/shared/metrics.ts'
import { addDecimals, decimalResult, roundDecimal } from '../src/widgets/decimals.ts'
import {
  axisLabel,
  axisTicks,
  bucketAt,
  bucketLabels,
  compactValue,
  niceTicks,
  trendShapes,
} from '../src/shared/trends.ts'
import { visibleWidgets, widgetData, widgetSchema } from '../src/widgets/compute.ts'
import { metric } from '../src/widgets/metrics.ts'
import { periodBounds, rangeBounds, rangeInfo } from '../src/widgets/ranges.ts'
import { bucketBounds, bucketCounts, bucketFor } from '../src/widgets/buckets.ts'

const LAGOS = 'Africa/Lagos'
const admins = Bouncer.ability(() => true)

class OrderPolicy {
  viewList() {}
}
class NoListPolicy {
  view() {}
}

class Order extends BaseModel {
  static table = 'orders'
  @column({ isPrimary: true }) declare id: number
  @column() declare status: string
  @column() declare total: string
  @column() declare quantity: number
  @column() declare userId: number
  @column.dateTime() declare placedAt: DateTime
}

const orders = defineResource(Order, {
  policy: OrderPolicy,
  columns: [
    listColumn.text('status'),
    listColumn.decimal('total'),
    listColumn.number('quantity'),
    listColumn.datetime('placedAt'),
  ],
  filters: [
    filter.select('status', { paid: 'Paid', pending: 'Pending' }),
    filter.dateRange('placedAt'),
  ],
})

/** A request whose Bouncer allows `viewList` on `allowed` policies */
function request(allowed: unknown[] = [OrderPolicy]) {
  const errors: string[] = []
  return {
    errors,
    ctx: {
      logger: {
        warn() {},
        error: (_: unknown, message: string) => errors.push(message),
      },
      bouncer: {
        allows: async () => true,
        with: (policy: unknown) => ({ allows: async () => allowed.includes(policy) }),
      },
    } as unknown as HttpContext,
  }
}

const loose = (options: Record<string, unknown>) =>
  defineScreen({ label: 'Overview', ability: admins, ...options } as never)

test.group('Widget ranges (FR-24)', () => {
  test('rolling ranges cover N days to now; the previous period is N days earlier', ({
    assert,
  }) => {
    const now = DateTime.fromISO('2026-10-20T10:00', { zone: LAGOS })
    const week = rangeBounds('7d', LAGOS, now)
    assert.equal(week.start.toISO(), '2026-10-14T00:00:00.000+01:00')
    assert.equal(week.end.toISO(), '2026-10-20T10:00:00.000+01:00')
    assert.equal(week.previous.start.toISO(), '2026-10-07T00:00:00.000+01:00')
    assert.equal(week.previous.end.toISO(), '2026-10-13T10:00:00.000+01:00')
    assert.deepInclude(rangeInfo('7d', week, LAGOS), {
      from: '2026-10-14',
      to: '2026-10-20',
      previousFrom: '2026-10-07',
      previousTo: '2026-10-13',
    })
  })

  test('to-date ranges compare with as long at the start of the period before', ({ assert }) => {
    const now = DateTime.fromISO('2026-10-20T10:00', { zone: LAGOS })
    const month = rangeBounds('month', LAGOS, now)
    assert.equal(month.start.toISO(), '2026-10-01T00:00:00.000+01:00')
    assert.equal(month.previous.start.toISO(), '2026-09-01T00:00:00.000+01:00')
    assert.equal(month.previous.end.toISO(), '2026-09-20T10:00:00.000+01:00')

    const today = rangeBounds('today', LAGOS, now)
    assert.equal(today.previous.start.toISO(), '2026-10-19T00:00:00.000+01:00')
    assert.equal(today.previous.end.toISO(), '2026-10-19T10:00:00.000+01:00')

    // March 31st: February is shorter, so the comparison stops at March 1st
    const march = rangeBounds('month', LAGOS, DateTime.fromISO('2026-03-31T12:00', { zone: LAGOS }))
    assert.equal(march.previous.start.toISO(), '2026-02-01T00:00:00.000+01:00')
    assert.equal(march.previous.end.toISO(), '2026-03-01T00:00:00.000+01:00')
    assert.equal(rangeInfo('month', march, LAGOS).previousTo, '2026-02-28')

    const quarter = rangeBounds('quarter', LAGOS, now)
    assert.equal(quarter.start.toISODate(), '2026-10-01')
    assert.equal(quarter.previous.start.toISODate(), '2026-07-01')
    assert.equal(rangeBounds('year', LAGOS, now).previous.start.toISODate(), '2025-01-01')
  })

  test("ranges are in the admin's timezone, not the server's", ({ assert }) => {
    // 00:30 in Lagos is still the day before in UTC
    const now = DateTime.fromISO('2026-10-20T00:30', { zone: LAGOS })
    const today = rangeBounds('today', LAGOS, now)
    assert.equal(today.start.toUTC().toISO(), '2026-10-19T23:00:00.000Z')
    assert.equal(rangeInfo('today', today, LAGOS).from, '2026-10-20')
  })

  test('progress periods measure how far through they are', ({ assert }) => {
    const now = DateTime.fromISO('2026-10-16T12:00', { zone: LAGOS })
    const month = periodBounds('month', LAGOS, now)
    assert.equal(month.start.toISODate(), '2026-10-01')
    assert.equal(month.end.toISODate(), '2026-11-01')
    assert.closeTo(month.elapsed, 15.5 / 31, 0.0001)
    assert.equal(periodBounds('week', LAGOS, now).start.toISODate(), '2026-10-12')
    assert.equal(periodBounds('day', LAGOS, now).elapsed, 0.5)
  })

  test('the range comes from the URL, falling back to the first offered', ({ assert }) => {
    assert.equal(parseRange('7d', ['30d', '7d']), '7d')
    assert.equal(parseRange('90d', ['30d', '7d']), '30d')
    assert.equal(parseRange('nonsense', ['month']), 'month')
    assert.equal(parseRange(undefined, []), '30d')
    assert.equal(withRange('/admin?x=1', '7d', '30d'), '/admin?x=1&range=7d')
    assert.equal(withRange('/admin?range=7d', '30d', '30d'), '/admin')
  })

  test('the summary names the days and what they compare with', ({ assert }) => {
    const info = {
      name: '30d' as const,
      from: '2026-09-21',
      to: '2026-10-20',
      previousFrom: '2026-08-22',
      previousTo: '2026-09-20',
      timezone: LAGOS,
    }
    assert.equal(
      rangeSummary(info, { locale: 'en-US' }),
      'Sep 21 – Oct 20, compared with the 30 days before · Africa/Lagos'
    )
    assert.equal(
      rangeSummary(
        { ...info, name: 'today', from: '2026-10-20' },
        { compared: false, locale: 'en-US' }
      ),
      'Oct 20 · Africa/Lagos'
    )
  })
})

test.group('Widget values (FR-24)', () => {
  test('comparisons: a change, new, no change, with higher better', ({ assert }) => {
    assert.deepEqual(compareValues('4812500.00', '4281750.00'), {
      kind: 'change',
      direction: 'up',
      percent: '12.4%',
      outcome: 'better',
    })
    assert.deepEqual(compareValues(57, 61), {
      kind: 'change',
      direction: 'down',
      percent: '6.6%',
      outcome: 'worse',
    })
    // 0 → n is new, n → 0 a 100% fall, both 0 no change
    assert.deepEqual(compareValues('10', '0'), { kind: 'new' })
    assert.deepEqual(compareValues('0', '5'), {
      kind: 'change',
      direction: 'down',
      percent: '100.0%',
      outcome: 'worse',
    })
    assert.deepEqual(compareValues('0', '0'), { kind: 'same' })
    assert.equal(comparisonText(compareValues('112', '100'), '₦100'), 'Up 12.0% from ₦100, better')
    assert.equal(comparisonText({ kind: 'new' }, '0'), 'New')
    assert.equal(comparisonText({ kind: 'same' }, '0'), 'No change')
  })

  test('comparisons with lower better: the direction stays real, the outcome flips', ({
    assert,
  }) => {
    assert.deepEqual(compareValues(3, 8, 'lower'), {
      kind: 'change',
      direction: 'down',
      percent: '62.5%',
      outcome: 'better',
    })
    assert.deepEqual(compareValues(8, 7, 'lower'), {
      kind: 'change',
      direction: 'up',
      percent: '14.3%',
      outcome: 'worse',
    })
    // n → 0 is better, 0 → n stays neutral "new", and no change is neutral
    assert.deepEqual(compareValues(0, 4, 'lower'), {
      kind: 'change',
      direction: 'down',
      percent: '100.0%',
      outcome: 'better',
    })
    assert.deepEqual(compareValues(4, 0, 'lower'), { kind: 'new' })
    assert.deepEqual(compareValues(0, 0, 'lower'), { kind: 'same' })
    assert.equal(comparisonText(compareValues(3, 8, 'lower'), '8'), 'Down 62.5% from 8, better')
  })

  test('shares and time left', ({ assert }) => {
    assert.equal(percentOf(0.5432), '54%')
    assert.equal(timeLeft(12 * 86_400_000 - 1), '12 days left')
    assert.equal(timeLeft(3 * 3_600_000), '3 hours left')
  })

  test('decimals stay exact strings, at the column scale', ({ assert }) => {
    // Postgres and MySQL: strings; SQLite: numbers, floats included
    assert.equal(decimalResult('12500.50', 2), '12500.50')
    assert.equal(decimalResult(0.1 + 0.2, 2), '0.30')
    assert.equal(decimalResult(1234.565, 2), '1234.57')
    assert.equal(decimalResult('12345.6750000000', 2), '12345.68')
    assert.equal(decimalResult(null, 2), '0.00')
    assert.equal(decimalResult(42, null), '42')
    assert.equal(decimalResult('42', null), '42')
    assert.equal(decimalResult(1e21, null), '1000000000000000000000')
    assert.equal(roundDecimal('-2.345', 2), '-2.35')
    assert.equal(roundDecimal('-0.001', 2), '0.00')
    assert.equal(roundDecimal('7.5', 2), '7.50')
    assert.equal(addDecimals(['10.50', '0.25', '3']), '13.75')
    assert.equal(addDecimals(['-1.5', '1']), '-0.5')
  })
})

test.group('Widgets screens (FR-24)', () => {
  test('a screen has exactly one of component, form or widgets', ({ assert }) => {
    const widgets = [metric.value('Orders').count(orders)]
    assert.throws(
      () => loose({ component: 'Overview', widgets }),
      /exactly one of "component".*"form".*"widgets".*not more than one/
    )
    assert.throws(
      () =>
        loose({
          widgets,
          form: {
            fields: [],
            validator: { validate: async () => ({}) },
            load: () => ({}),
            save() {},
          },
        }),
      /not more than one/
    )
    assert.throws(() => loose({ widgets, data: () => ({}) }), /widgets and "data"/)
    assert.throws(
      () => loose({ component: 'Overview', ranges: ['7d'] }),
      /"ranges", which only a widgets screen uses/
    )
    assert.throws(() => loose({ widgets: [] }), /at least one widget/)
    assert.throws(() => loose({ widgets, ranges: ['week'] }), /ranges include "week"/)
    assert.throws(() => loose({ widgets: [{}] }), /made with metric.value\(\)/)

    const screen = loose({ widgets, ranges: ['7d', '30d'] })
    assert.deepEqual(screen.ranges, ['7d', '30d'])
    assert.include(screen.toSchema('overview'), { component: null, form: false, widgets: true })
    assert.deepEqual(loose({ widgets }).ranges, ['30d'])
  })

  test('boot errors name the widget: link filters, date columns, missing parts', ({ assert }) => {
    assert.throws(
      () => loose({ widgets: [metric.value('Paid').count(orders).link({ state: 'paid' })] }),
      /"Paid" widget links with the "state" filter, which the "orders" resource doesn't have \(it has status, placedAt\)/
    )
    assert.throws(
      () => loose({ widgets: [metric.value('Paid').count(orders).link({ status: 'refunded' })] }),
      /links with status=refunded, which that filter doesn't take/
    )
    assert.throws(
      () =>
        loose({
          widgets: [
            metric
              .value('Odd')
              .count(orders)
              .date('status' as never),
          ],
        }),
      /"Odd" widget's date\(\) column, "status", isn't a date or datetime column on Order/
    )
    assert.throws(
      () => loose({ widgets: [metric.value('Custom').using(() => 1)] }),
      /uses using\(\) without an ability/
    )
    assert.throws(
      () => loose({ widgets: [metric.partition('By status').count(orders)] }),
      /"By status" widget needs groupBy\(\)/
    )
    assert.throws(
      () => loose({ widgets: [metric.progress('Goal').count(orders).date('placedAt')] }),
      /"Goal" widget needs goal\(\)/
    )
    assert.throws(
      () => loose({ widgets: [metric.progress('Goal').count(orders).goal(5)] }),
      /"Goal" widget needs date\(\)/
    )
    assert.throws(
      () => loose({ widgets: [metric.table('Recent').resource(orders).limit(0)] }),
      /limit\(\) must be a whole number/
    )
  })

  test('doctor: widget problems are errors; a resource without viewList is a warning', ({
    assert,
  }) => {
    const unlisted = defineResource(Order, { policy: NoListPolicy })
    const screen = loose({ widgets: [metric.value('Orders').count(unlisted)] })
    // A problem boot would refuse, reported if a screen got past it
    screen.widgets![0].state.link = { state: 'paid' }
    assert.deepEqual(
      checkWidgets([{ name: 'overview', screen }]).map(({ level, area }) => `${level} ${area}`),
      ['error widgets', 'warning widgets']
    )
    assert.match(
      checkWidgets([{ name: 'overview', screen }])[1].message,
      /"Orders" widget reads orders, and NoListPolicy has no viewList, so it never shows/
    )
  })

  test('widgets list their width, note and comparison', ({ assert }) => {
    assert.deepInclude(widgetSchema('widget0', metric.value('All').count(orders)), {
      kind: 'value',
      width: 1,
      note: 'All time',
      compares: false,
      better: 'higher',
    })
    assert.deepInclude(
      widgetSchema(
        'widget5',
        metric.value('Refunds').count(orders).date('placedAt').lowerIsBetter()
      ),
      { better: 'lower', compares: true }
    )
    assert.deepInclude(
      widgetSchema(
        'widget6',
        metric
          .value('Mine')
          .using(() => 1)
          .ability(admins)
          .lowerIsBetter()
      ),
      { better: 'lower' }
    )
    assert.deepInclude(
      widgetSchema('widget1', metric.value('Ranged').count(orders).date('placedAt')),
      { note: null, compares: true }
    )
    assert.deepInclude(
      widgetSchema('widget2', metric.value('Off').count(orders).date('placedAt').compare(false)),
      { compares: false }
    )
    assert.deepInclude(widgetSchema('widget3', metric.table('T').resource(orders)), { width: 2 })
    assert.deepInclude(widgetSchema('widget4', metric.table('T').resource(orders).width(4)), {
      width: 4,
    })
  })

  test("a user without the resource's viewList, or the custom ability, doesn't get it", async ({
    assert,
  }) => {
    const denied = Bouncer.ability(() => false)
    const widgets = [
      metric.value('Orders').count(orders),
      metric
        .value('Custom')
        .using(() => 1)
        .ability(admins),
      metric
        .value('Hidden')
        .using(() => 1)
        .ability(denied),
    ]
    const ctx = {
      bouncer: {
        allows: async (ability: unknown) => ability === admins,
        with: () => ({ allows: async () => false }),
      },
      logger: { warn() {} },
    } as unknown as HttpContext
    const visible = await visibleWidgets(ctx, widgets)
    assert.deepEqual(
      visible.map(({ key }) => key),
      ['widget1']
    )
  })
})

test.group('Widget data on SQLite (FR-24)', (group) => {
  let db: Database
  group.each.setup(async () => {
    db = new Database(
      {
        connection: 'sqlite',
        connections: {
          sqlite: {
            client: 'better-sqlite3',
            connection: { filename: ':memory:' },
            useNullAsDefault: true,
          },
        },
      },
      new Logger({ name: 'widgets-test', enabled: false }),
      { emit() {}, hasListeners: () => false } as never
    )
    Order.$adapter = db.modelAdapter()
    await db.connection().schema.createTable('orders', (table) => {
      table.increments('id')
      table.string('status')
      table.decimal('total', 12, 2)
      table.integer('quantity')
      table.integer('user_id')
      table.timestamp('placed_at')
    })
    const now = DateTime.now()
    await Order.createMany([
      {
        status: 'paid',
        total: '100.10',
        quantity: 1,
        userId: 1,
        placedAt: now.minus({ hours: 1 }),
      },
      { status: 'paid', total: '200.20', quantity: 2, userId: 2, placedAt: now.minus({ days: 2 }) },
      {
        status: 'pending',
        total: '0.30',
        quantity: 3,
        userId: 1,
        placedAt: now.minus({ days: 3 }),
      },
      // In the previous 7 days, and older
      { status: 'paid', total: '50.00', quantity: 4, userId: 1, placedAt: now.minus({ days: 9 }) },
      {
        status: 'paid',
        total: '999.99',
        quantity: 5,
        userId: 1,
        placedAt: now.minus({ days: 400 }),
      },
    ])
    return () => db.manager.closeAll()
  })

  const context = { path: '/admin', timezone: 'UTC' }
  const range = () => {
    const bounds = rangeBounds('7d', 'UTC')
    return { name: '7d' as const, bounds, info: rangeInfo('7d', bounds, 'UTC') }
  }

  test('values: exact sums, averages at the column scale, comparisons and links', async ({
    assert,
  }) => {
    const { ctx } = request()
    const revenue = metric
      .value('Revenue')
      .sum(orders, 'total')
      .where((query) => query.where('status', 'paid'))
      .date('placedAt')
      .link({ status: 'paid' })
    const data = await widgetData(ctx, context, 'overview', revenue, range())
    assert.deepInclude(data, {
      status: 'ok',
      kind: 'value',
      value: '300.30',
      previous: '50.00',
      comparison: { kind: 'change', direction: 'up', percent: '500.6%', outcome: 'better' },
    })
    const info = range().info
    assert.equal(
      (data as { href: string }).href,
      `/admin/resources/orders?placedAt=${info.from}..${info.to}&status=paid`
    )

    const average = await widgetData(
      ctx,
      context,
      'overview',
      metric.value('Average').avg(orders, 'total').date('placedAt'),
      range()
    )
    // (100.10 + 200.20 + 0.30) / 3 = 100.2
    assert.include(average, { value: '100.20' })

    const allTime = await widgetData(
      ctx,
      context,
      'overview',
      metric.value('All').count(orders),
      range()
    )
    assert.include(allTime, { value: '5', previous: null, comparison: null, href: null })

    const items = await widgetData(
      ctx,
      context,
      'overview',
      metric.value('Items').avg(orders, 'quantity').date('placedAt'),
      range()
    )
    assert.include(items, { value: '2.00' })
  })

  test("every query starts from the resource's query hook", async ({ assert }) => {
    const { ctx } = request()
    const mine = defineResource(Order, {
      policy: OrderPolicy,
      query: (query) => query.where('userId', 1),
      columns: [listColumn.decimal('total')],
    })
    const all = await widgetData(
      ctx,
      context,
      'overview',
      metric.value('All').count(orders),
      range()
    )
    const scoped = await widgetData(
      ctx,
      context,
      'overview',
      metric.value('Mine').count(mine),
      range()
    )
    assert.include(all, { value: '5' })
    assert.include(scoped, { value: '4' })
    const total = await widgetData(
      ctx,
      context,
      'overview',
      metric.value('Mine').sum(mine, 'total'),
      range()
    )
    assert.include(total, { value: '1150.39' })
  })

  test('partitions fold into Other, label from the select filter and link by value', async ({
    assert,
  }) => {
    const { ctx } = request()
    const data = (await widgetData(
      ctx,
      context,
      'overview',
      metric.partition('By status').count(orders).groupBy('status').limit(1),
      range()
    )) as Extract<Awaited<ReturnType<typeof widgetData>>, { kind: 'partition' }>
    assert.equal(data.total, '5')
    assert.deepEqual(
      data.rows.map((row) => [row.label, row.value, row.href]),
      [
        ['Paid', '4', '/admin/resources/orders?status=paid'],
        ['Other', '1', null],
      ]
    )
    assert.equal(data.rows[0].percent, 0.8)
    assert.deepEqual(data.unit, { one: 'order', other: 'orders' })
  })

  test("ties keep the options' order, then the label's", async ({ assert }) => {
    const { ctx } = request()
    const now = DateTime.now()
    // 4 paid and 4 pending
    for (let index = 0; index < 3; index++) {
      await Order.create({
        status: 'pending',
        total: '1.00',
        quantity: 1,
        userId: 3,
        placedAt: now,
      })
    }
    // Options listed pending first: that order wins over the labels'
    const pendingFirst = defineResource(Order, {
      policy: OrderPolicy,
      filters: [filter.select('status', { pending: 'Pending', paid: 'Paid' })],
    })
    const noOptions = defineResource(Order, { policy: OrderPolicy })
    for (const [resource, expected] of [
      [pendingFirst, ['Pending', 'Paid']],
      [orders, ['Paid', 'Pending']],
      [noOptions, ['Paid', 'Pending']],
    ] as const) {
      for (let run = 0; run < 3; run++) {
        const data = (await widgetData(
          ctx,
          context,
          'overview',
          metric.partition('By status').count(resource).groupBy('status'),
          range()
        )) as Extract<Awaited<ReturnType<typeof widgetData>>, { kind: 'partition' }>
        assert.deepEqual(
          data.rows.map((row) => row.label),
          expected
        )
      }
    }
  })

  test('trends: one bucket per day, empty ones 0, exact sums, the previous period aligned', async ({
    assert,
  }) => {
    const { ctx } = request()
    type Trend = Extract<Awaited<ReturnType<typeof widgetData>>, { kind: 'trend' }>
    const count = (await widgetData(
      ctx,
      context,
      'overview',
      metric.trend('Orders').count(orders).date('placedAt').compare(),
      range()
    )) as Trend
    assert.equal(count.unit, 'day')
    assert.lengthOf(count.buckets, 7)
    // Three orders in the last 7 days, one in the 7 before
    assert.equal(count.total, '3')
    assert.equal(count.previousTotal, '1')
    assert.isTrue(count.buckets.some((bucket) => bucket.value === '0'))
    assert.isTrue(count.buckets.every((bucket) => bucket.previous !== null))
    assert.equal(
      count.buckets.at(-1)!.end.slice(0, 10),
      DateTime.utc().plus({ days: 1 }).toISODate()
    )
    // Each day links to the list filtered to it
    const day = count.buckets[0].start.slice(0, 10)
    assert.equal(count.buckets[0].href, `/admin/resources/orders?placedAt=${day}..${day}`)

    const revenue = (await widgetData(
      ctx,
      context,
      'overview',
      metric.trend('Revenue').sum(orders, 'total').date('placedAt').bars(),
      range()
    )) as Trend
    assert.equal(revenue.chart, 'bars')
    assert.equal(revenue.total, '300.60')
    assert.isTrue(revenue.buckets.every((bucket) => /^\d+\.\d{2}$/.test(bucket.value)))
    assert.isNull(revenue.previousTotal)
    assert.equal(revenue.noun, 'orders')
  })

  test('progress against a goal, over its own period', async ({ assert }) => {
    const { ctx } = request()
    const data = await widgetData(
      ctx,
      context,
      'overview',
      metric
        .progress('Goal')
        .sum(orders, 'total')
        .date('placedAt')
        .period('year')
        .goal(async () => 1000),
      range()
    )
    assert.include(data, { status: 'ok', kind: 'progress', goal: '1000' })
    assert.isAbove((data as { share: number }).share, 0)
    assert.isAbove((data as { pace: number }).pace, 0)
  })

  test("a widget that throws is an error, logged with the screen's and widget's names", async ({
    assert,
  }) => {
    const { ctx, errors } = request()
    const broken = metric
      .value('Broken')
      .count(orders)
      .where((query) => query.whereRaw('no_such_column = 1'))
    const data = await widgetData(ctx, context, 'overview', broken, range())
    assert.deepEqual(data, { status: 'error' })
    assert.deepEqual(errors, [`Azu couldn't load the "Broken" widget on the "overview" screen`])
  })
})

test.group('Trend buckets (FR-25)', () => {
  const LONDON = 'Europe/London'
  const at = (iso: string, zone: string) => DateTime.fromISO(iso, { zone })
  const starts = (
    unit: Parameters<typeof bucketBounds>[0],
    from: string,
    to: string,
    zone: string
  ) =>
    bucketBounds(unit, { start: at(from, zone), end: at(to, zone) }, zone).map((bucket) =>
      bucket.start.toISO()
    )

  test('hours, days, weeks (from Monday) and months in Africa/Lagos', ({ assert }) => {
    assert.deepEqual(starts('hour', '2026-10-20T00:00', '2026-10-20T02:30', LAGOS), [
      '2026-10-20T00:00:00.000+01:00',
      '2026-10-20T01:00:00.000+01:00',
      '2026-10-20T02:00:00.000+01:00',
    ])
    assert.deepEqual(starts('day', '2026-10-18T00:00', '2026-10-20T10:00', LAGOS), [
      '2026-10-18T00:00:00.000+01:00',
      '2026-10-19T00:00:00.000+01:00',
      '2026-10-20T00:00:00.000+01:00',
    ])
    // Thursday 1 October falls in the week of Monday 28 September
    assert.deepEqual(starts('week', '2026-10-01T00:00', '2026-10-13T09:00', LAGOS), [
      '2026-09-28T00:00:00.000+01:00',
      '2026-10-05T00:00:00.000+01:00',
      '2026-10-12T00:00:00.000+01:00',
    ])
    assert.deepEqual(starts('month', '2026-01-01T00:00', '2026-03-05T09:00', LAGOS), [
      '2026-01-01T00:00:00.000+01:00',
      '2026-02-01T00:00:00.000+01:00',
      '2026-03-01T00:00:00.000+01:00',
    ])
  })

  test('Europe/London on 25 October 2026: a 25-hour day and a repeated hour', ({ assert }) => {
    const [day] = bucketBounds(
      'day',
      { start: at('2026-10-25T00:00', LONDON), end: at('2026-10-25T23:00', LONDON) },
      LONDON
    )
    assert.equal(day.end.diff(day.start, 'hours').hours, 25)
    assert.equal(day.end.toISO(), '2026-10-26T00:00:00.000+00:00')

    const hours = bucketBounds(
      'hour',
      { start: at('2026-10-25T00:00', LONDON), end: at('2026-10-25T03:30', LONDON) },
      LONDON
    )
    // 01:00 twice: first in summer time, then in winter time, an hour apart
    assert.deepEqual(
      hours.map((bucket) => bucket.start.toISO()),
      [
        '2026-10-25T00:00:00.000+01:00',
        '2026-10-25T01:00:00.000+01:00',
        '2026-10-25T01:00:00.000+00:00',
        '2026-10-25T02:00:00.000+00:00',
        '2026-10-25T03:00:00.000+00:00',
      ]
    )
    assert.isTrue(hours.every((bucket) => bucket.end.diff(bucket.start, 'minutes').minutes === 60))

    // In spring the clocks go forward: 01:00 never happens, and the day is 23 hours
    const spring = bucketBounds(
      'hour',
      { start: at('2026-03-29T00:00', LONDON), end: at('2026-03-29T03:00', LONDON) },
      LONDON
    ).map((bucket) => bucket.start.toFormat('HH:mm'))
    assert.deepEqual(spring, ['00:00', '02:00'])
    const [short] = bucketBounds(
      'day',
      { start: at('2026-03-29T00:00', LONDON), end: at('2026-03-29T12:00', LONDON) },
      LONDON
    )
    assert.equal(short.end.diff(short.start, 'hours').hours, 23)
  })

  test('the bucket follows the range, and more than 100 is refused', ({ assert }) => {
    assert.deepEqual(
      (['today', '7d', '30d', '90d', 'month', 'quarter', 'year'] as const).map(bucketFor),
      ['hour', 'day', 'day', 'day', 'day', 'week', 'month']
    )
    assert.throws(
      () =>
        bucketBounds(
          'hour',
          { start: at('2026-10-01T00:00', LAGOS), end: at('2026-10-10T00:00', LAGOS) },
          LAGOS
        ),
      /More than 100 hours in this range/
    )
    assert.deepEqual(bucketCounts('hour', '90d'), { min: 2137, max: 2161 })
    assert.deepEqual(bucketCounts('day', 'year'), { min: 1, max: 366 })
    assert.isAtMost(bucketCounts('week', 'quarter').max, 100)
    assert.isAtMost(bucketCounts('month', 'year').max, 100)
  })

  test('boot refuses a by() that always needs more than 100; doctor one that can', ({ assert }) => {
    assert.throws(
      () =>
        loose({
          ranges: ['today', '30d'],
          widgets: [metric.trend('Hourly').count(orders).date('placedAt').by('hour')],
        }),
      /"Hourly" trend counts by\('hour'\), which needs more than 100 buckets for 30d/
    )
    assert.throws(
      () => loose({ widgets: [metric.trend('Dateless').count(orders)] }),
      /"Dateless" widget needs date\(\)/
    )
    // Day buckets over a year: fine in January, too many by April
    const screen = loose({
      ranges: ['30d', 'year'],
      widgets: [metric.trend('Daily').count(orders).date('placedAt').by('day')],
    })
    assert.deepEqual(
      checkWidgets([{ name: 'overview', screen }]).map((finding) => finding.message),
      [
        `the overview screen: the "Daily" trend counts by('day'), which can need more than 100 buckets for year: use a longer unit, or leave by() out to follow the range`,
      ]
    )
    // Without by(), it follows the range and never needs too many
    const auto = loose({
      ranges: ['today', '7d', '30d', '90d', 'month', 'quarter', 'year'],
      widgets: [metric.trend('Auto').count(orders).date('placedAt')],
    })
    assert.deepEqual(checkWidgets([{ name: 'overview', screen: auto }]), [])
    assert.deepInclude(widgetSchema('widget0', auto.widgets![0]), {
      kind: 'trend',
      width: 4,
      compares: false,
    })
  })
})

test.group('Trend chart helpers (FR-25)', () => {
  test('x labels: an even step, the last included, fewer when narrow', ({ assert }) => {
    assert.deepEqual(axisTicks(30, 1000, 40), [0, 5, 10, 15, 20, 25, 29])
    // The year by month on a phone: no two months side by side
    assert.deepEqual(axisTicks(10, 280, 24), [0, 2, 4, 6, 9])
    assert.deepEqual(axisTicks(7, 1000, 40), [0, 1, 2, 3, 4, 5, 6])
    assert.deepEqual(axisTicks(90, 260, 40), [0, 23, 46, 69, 89])
    assert.deepEqual(axisTicks(1, 300, 40), [0])
  })

  test('y ticks: 3 or 4 round steps from 0, and compact labels', ({ assert }) => {
    assert.deepEqual(niceTicks(19_500), [0, 10_000, 20_000])
    assert.deepEqual(niceTicks(240_000), [0, 100_000, 200_000, 300_000])
    assert.deepEqual(niceTicks(7), [0, 2.5, 5, 7.5])
    assert.deepEqual(niceTicks(0), [0])
    assert.equal(compactValue(80_000, { style: 'currency', currency: 'NGN' }, 'en'), '₦80K')
    assert.equal(compactValue(1200, null, 'en'), '1.2K')
  })

  test('bucket labels in the admin timezone, the repeated hour told apart', ({ assert }) => {
    const iso = (value: string, zone: string) => DateTime.fromISO(value, { zone }).toISO()!
    const day = { start: iso('2026-10-14T00:00', LAGOS), end: iso('2026-10-15T00:00', LAGOS) }
    assert.deepEqual(bucketLabels([day], 'day', LAGOS), ['Wed 14 Oct'])
    assert.deepEqual(bucketLabels([day], 'week', LAGOS), ['Week of 14 Oct'])
    assert.deepEqual(bucketLabels([day], 'month', LAGOS), ['October 2026'])
    assert.deepEqual(
      bucketLabels(
        [{ start: iso('2026-10-14T14:00', LAGOS), end: iso('2026-10-14T15:00', LAGOS) }],
        'hour',
        LAGOS
      ),
      ['14:00–15:00']
    )
    const london = 'Europe/London'
    const hours = bucketBounds(
      'hour',
      {
        start: DateTime.fromISO('2026-10-25T00:00', { zone: london }),
        end: DateTime.fromISO('2026-10-25T02:30', { zone: london }),
      },
      london
    ).map((bucket) => ({ start: bucket.start.toISO()!, end: bucket.end.toISO()! }))
    assert.deepEqual(bucketLabels(hours, 'hour', london), [
      '00:00–01:00',
      '01:00–02:00 GMT+1',
      '01:00–02:00 GMT',
      '02:00–03:00',
    ])
    assert.equal(axisLabel(day, 'day', LAGOS), '14 Oct')
    assert.equal(axisLabel(day, 'month', LAGOS), 'Oct')
  })

  test('shapes: the line through the middles, bars with a gap, the bucket under a pointer', ({
    assert,
  }) => {
    const box = { left: 50, top: 10, width: 300, height: 200 }
    const shapes = trendShapes([0, 50, 100], [100, 0, 0], box, 100)
    assert.deepEqual(shapes.x, [100, 200, 300])
    assert.deepEqual(shapes.y, [210, 110, 10])
    assert.equal(shapes.line, 'M100.0 210.0 L200.0 110.0 L300.0 10.0')
    assert.equal(shapes.previous, 'M100.0 10.0 L200.0 210.0 L300.0 210.0')
    assert.equal(shapes.bars[0], '')
    assert.match(
      shapes.bars[2],
      /^M251 210 L251 13 Q251 10 254 10 L346 10 Q349 10 349 13 L349 210 Z$/
    )
    assert.equal(bucketAt(149, box, 3), 0)
    assert.equal(bucketAt(250, box, 3), 2)
    assert.isNull(bucketAt(20, box, 3))
  })
})
