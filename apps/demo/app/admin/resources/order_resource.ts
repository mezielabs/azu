import { Exception } from '@adonisjs/core/exceptions'
import { action, column, defineResource, filter } from '@mezielabs/azu'
import Order from '#models/order'
import OrderPolicy from '#policies/order_policy'

export default defineResource(Order, {
  group: 'Sales',
  icon: 'receipt',
  order: 1,
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

  actions: [
    /**
     * Rolls back when it throws: cancelling a shipped order fails the
     * whole batch, including orders it already cancelled (FR-12).
     */
    action
      .bulk('cancel')
      .confirm('Cancel the selected orders?')
      .ability('cancel')
      .destructive()
      .handle(async (orders) => {
        for (const order of orders) {
          if (order.status === 'shipped') {
            throw new Exception(`Order ${order.number} has shipped, so it can't be cancelled.`, {
              status: 422,
            })
          }
          order.status = 'cancelled'
          await order.save()
        }
        return { message: `Cancelled ${orders.length} ${orders.length === 1 ? 'order' : 'orders'}` }
      }),
  ],
})
