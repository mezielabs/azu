import vine from '@vinejs/vine'

const fields = {
  name: vine.string().trim().minLength(2).maxLength(160),
  description: vine.string().trim().nullable().optional(),
  /**
   * A decimal column: kept as an exact string end to end, so validate
   * the format instead of parsing it into a float.
   */
  price: vine
    .string()
    .trim()
    .regex(/^\d{1,10}(\.\d{1,2})?$/),
  /**
   * Optional: the README's ProductResource has no stock field, and the
   * column defaults to 0
   */
  stock: vine.number().withoutDecimals().min(0).optional(),
  status: vine.enum(['draft', 'published'] as const),
  isFeatured: vine.boolean().optional(),
  categoryId: vine.number().exists({ table: 'categories', column: 'id' }),
  publishedAt: vine.date().nullable().optional(),
  tags: vine.array(vine.number()).maxLength(10).optional(),
}

export const createProductValidator = vine.create({
  ...fields,
  sku: vine
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]+$/)
    .maxLength(40)
    .unique({ table: 'products', column: 'sku' }),
})

export const updateProductValidator = vine.create({
  ...fields,
  sku: vine
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]+$/)
    .maxLength(40)
    .unique({
      table: 'products',
      column: 'sku',
      filter: (query, _value, field) => {
        query.whereNot('id', field.meta.productId)
      },
    }),
})
