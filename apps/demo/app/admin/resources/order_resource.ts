import { column, defineResource, filter } from '@mezielabs/azu'
import Order from '#models/order'
import OrderPolicy from '#policies/order_policy'

export default defineResource(Order, {
  group: 'Sales',
  icon: 'receipt',
  title: 'number',
  search: ['number'],
  policy: OrderPolicy,
  query: (q) => q.preload('user'),

  columns: [
    column.text('number').sortable(),
    column.belongsTo('user', 'email'),
    column
      .badge('status')
      .colors({ pending: 'gray', paid: 'blue', shipped: 'green', cancelled: 'red' }),
    column.decimal('total').format('currency', 'NGN').sortable(),
    column.datetime('placedAt').sortable(),
  ],

  filters: [
    filter.select('status', {
      pending: 'Pending',
      paid: 'Paid',
      shipped: 'Shipped',
      cancelled: 'Cancelled',
    }),
    filter.dateRange('placedAt'),
  ],
})
