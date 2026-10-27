import { defineScreen, metric } from '@mezielabs/azu'
import db from '@adonisjs/lucid/services/db'
import { accessAdmin, viewReports } from '#abilities/main'
import orders from '#admin/resources/order_resource'
import products from '#admin/resources/product_resource'

/** Orders that brought money in: not pending, not cancelled */
const SOLD = ['paid', 'shipped']

/**
 * The demo's home screen (FR-22): widgets (FR-24), each shown only to
 * users who may list its resource. Staff, who can't list orders, see
 * Low stock alone.
 *
 * On a 4-column grid: the four values; the revenue trend across the
 * grid; Cancelled orders and the goal beside Orders by status (2
 * columns); then the two tables. No row ends with a gap, at 4 columns
 * or 2.
 */
export default defineScreen({
  label: 'Overview',
  icon: 'layout-dashboard',
  ability: accessAdmin,
  ranges: ['30d', 'today', '7d', '90d', 'month', 'year'],
  widgets: [
    metric
      .value('Revenue')
      .sum(orders, 'total')
      .where((query) => query.whereIn('status', SOLD))
      .date('placedAt')
      .format('currency', 'NGN')
      // The range only: no list filter means "paid or shipped", so the
      // link shows every order in the range rather than a different total
      .link(),
    metric.value('Orders').count(orders).date('placedAt').link(),
    metric
      .value('Average order')
      .avg(orders, 'total')
      .where((query) => query.whereIn('status', SOLD))
      .date('placedAt')
      .format('currency', 'NGN'),
    // No customers resource: a value from a query, behind its own ability
    metric
      .value('New customers')
      .using(async (_ctx, range) => {
        const format = db.connection().dialect.dateTimeFormat
        const [row] = await db
          .from('users')
          .where('role', 'customer')
          .where('created_at', '>=', range.start.toLocal().toFormat(format))
          .where('created_at', '<=', range.end.toLocal().toFormat(format))
          .count('* as total')
        return Number(row.total)
      })
      .ability(viewReports),
    // A trend (FR-25), full width: days for 30 days, hours today, months
    // for the year, against the period before
    metric
      .trend('Revenue over time')
      .sum(orders, 'total')
      .where((query) => query.whereIn('status', SOLD))
      .date('placedAt')
      .format('currency', 'NGN')
      .compare(),
    // Down is good: fewer cancellations read as better
    metric
      .value('Cancelled orders')
      .count(orders)
      .where((query) => query.where('status', 'cancelled'))
      .date('placedAt')
      .lowerIsBetter()
      .link({ status: 'cancelled' }),
    metric
      .progress('Monthly revenue goal')
      .sum(orders, 'total')
      .where((query) => query.whereIn('status', SOLD))
      .date('placedAt')
      .period('month')
      .goal(750_000)
      .format('currency', 'NGN')
      // Short figures beside the bar: "NGN 182K of NGN 750K". From a
      // million up every widget abbreviates; the exact figure is on hover
      .compact(),
    metric.partition('Orders by status').count(orders).groupBy('status').date('placedAt').width(2),
    metric
      .table('Recent orders')
      .resource(orders)
      .columns(['number', 'status', 'total', 'placedAt'])
      .latest('placedAt')
      .limit(5)
      .link(),
    metric
      .table('Low stock')
      .resource(products)
      .where((query) => query.where('stock', '<', 10))
      .orderBy('stock', 'asc')
      .columns(['name', 'category', 'stock'])
      .limit(5)
      .link({ 'low-stock': true }),
  ],
})
