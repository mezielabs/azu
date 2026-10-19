import vine from '@vinejs/vine'
import type Coupon from '#models/coupon'
import { decimalString, labelled } from '#validators/messages'

export const CURRENCIES = ['NGN', 'GHS', 'KES', 'ZAR', 'USD', 'GBP'] as const

const fields = {
  description: vine.string().trim().maxLength(500).nullable().optional(),
  kind: vine.enum(['percent', 'fixed', 'free_shipping'] as const),
  /**
   * A decimal column: kept as an exact string, so validate the format
   * instead of parsing it into a float.
   */
  amount: decimalString(0),
  currency: vine.enum(CURRENCIES),
  usageLimit: vine.number().withoutDecimals().min(1).max(100000).nullable().optional(),
  isActive: vine.boolean(),
  categoryId: vine.number().exists({ table: 'categories', column: 'id' }).nullable().optional(),
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

const labels = {
  code: 'Code',
  description: 'Description',
  kind: 'Kind',
  amount: 'Amount',
  currency: 'Currency',
  usageLimit: 'Usage limit',
  isActive: 'Is active',
  categoryId: 'Category',
  startsOn: 'Starts on',
  expiresAt: 'Expires at',
}

const codeFormat = {
  'code.regex': 'Code may only contain letters, numbers, dashes and underscores',
}

export const createCouponValidator = labelled(
  vine.create({
    ...fields,
    code: code().unique({ table: 'coupons', column: 'code' }),
  }),
  labels,
  codeFormat
)

/**
 * Azu passes `{ record }` as metadata by default: the coupon being
 * edited, so its own code doesn't count as taken.
 */
export const updateCouponValidator = labelled(
  vine.withMetaData<{ record: Coupon }>().create({
    ...fields,
    code: code().unique({
      table: 'coupons',
      column: 'code',
      filter: (query, _value, field) => {
        query.whereNot('id', field.meta.record.id)
      },
    }),
  }),
  labels,
  codeFormat
)
