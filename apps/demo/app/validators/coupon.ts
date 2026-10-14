import vine from '@vinejs/vine'
import type Coupon from '#models/coupon'

export const CURRENCIES = ['NGN', 'GHS', 'KES', 'ZAR', 'USD', 'GBP'] as const

const fields = {
  description: vine.string().trim().maxLength(500).nullable().optional(),
  kind: vine.enum(['percent', 'fixed', 'free_shipping'] as const),
  /**
   * A decimal column: kept as an exact string, so validate the format
   * instead of parsing it into a float.
   */
  amount: vine
    .string()
    .trim()
    .regex(/^\d{1,10}(\.\d{1,2})?$/),
  currency: vine.enum(CURRENCIES),
  usageLimit: vine.number().withoutDecimals().min(1).max(100000).nullable().optional(),
  isActive: vine.boolean(),
  startsOn: vine.date(),
  expiresAt: vine.date().nullable().optional(),
}

const code = () =>
  vine
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]+$/)
    .minLength(3)
    .maxLength(32)

export const createCouponValidator = vine.create({
  ...fields,
  code: code().unique({ table: 'coupons', column: 'code' }),
})

/**
 * Azu passes `{ record }` as metadata by default: the coupon being
 * edited, so its own code doesn't count as taken.
 */
export const updateCouponValidator = vine.withMetaData<{ record: Coupon }>().create({
  ...fields,
  code: code().unique({
    table: 'coupons',
    column: 'code',
    filter: (query, _value, field) => {
      query.whereNot('id', field.meta.record.id)
    },
  }),
})
