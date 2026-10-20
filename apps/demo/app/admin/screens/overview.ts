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
 */
export default defineScreen({
  label: 'Overview',
  icon: 'layout-dashboard',
  ability: accessAdmin,
  ranges: ['30d', 'today', '7d', 'month'],
  widgets: [
    metric
      .value('Revenue')
      .sum(orders, 'total')
      .where((query) => query.whereIn('status', SOLD))
      .date('placedAt')
      .format('currency', 'NGN')
      .link({ status: 'paid' }),
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
    metric
      .progress('Monthly revenue goal')
      .sum(orders, 'total')
      .where((query) => query.whereIn('status', SOLD))
      .date('placedAt')
      .period('month')
      .goal(750_000)
      .format('currency', 'NGN')
      .width(2),
    metric.partition('Orders by status').count(orders).groupBy('status').date('placedAt').width(2),
    metric.table('Recent orders').resource(orders).latest('placedAt').limit(5).link(),
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
