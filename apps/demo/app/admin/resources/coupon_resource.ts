/**
 * Exercises every FR-06 form field kind, an optional belongsTo (FR-08),
 * the default `{ record }` validator metadata, and filters on a boolean,
 * an optional belongsTo and a date-only column (FR-13).
 */
import { column, defineResource, field, filter } from '@mezielabs/azu'
import Coupon from '#models/coupon'
import CouponPolicy from '#policies/coupon_policy'
import { createCouponValidator, updateCouponValidator } from '#validators/coupon'

export default defineResource(Coupon, {
  group: 'Sales',
  icon: 'ticket',
  title: 'code',
  search: ['code'],
  policy: CouponPolicy,
  query: (q) => q.preload('category'),
  validators: { create: createCouponValidator, update: updateCouponValidator },

  columns: [
    column.text('code').sortable(),
    column.badge('kind'),
    column.decimal('amount').sortable(),
    column.belongsTo('category', 'name'),
    column.boolean('isActive'),
    column.date('startsOn').sortable(),
    column.datetime('expiresAt').sortable(),
  ],

  fields: [
    field.text('code').help('Customers type this at checkout'),
    field.textarea('description'),
    field
      .select('kind')
      .options({ percent: 'Percent off', fixed: 'Fixed amount', free_shipping: 'Free shipping' }),
    field.decimal('amount').step('0.01'),
    field.select('currency').options({
      NGN: 'Nigerian naira',
      GHS: 'Ghanaian cedi',
      KES: 'Kenyan shilling',
      ZAR: 'South African rand',
      USD: 'US dollar',
      GBP: 'British pound',
    }),
    field.number('usageLimit').help('Leave empty for unlimited use'),
    field.belongsTo('category').searchable('name').help('Leave empty to apply to every product'),
    field.boolean('isActive').default(true),
    field.date('startsOn'),
    field.datetime('expiresAt'),
  ],

  filters: [
    filter.select('kind', {
      percent: 'Percent off',
      fixed: 'Fixed amount',
      free_shipping: 'Free shipping',
    }),
    filter.boolean('isActive').label('Active'),
    filter.belongsTo('category'),
    filter.dateRange('startsOn'),
  ],
})
