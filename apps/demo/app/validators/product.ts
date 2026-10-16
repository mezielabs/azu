import vine from '@vinejs/vine'

const fields = {
  name: vine.string().trim().minLength(2).maxLength(160),
  /** Sanitised HTML from the rich text field */
  description: vine.string().trim().maxLength(20000).nullable().optional(),
  /** A Drive key: Azu checks and stores the upload, then validates its key */
  thumbnail: vine.string().maxLength(255).nullable().optional(),
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
  /** The product's tags, as their keys: Azu syncs the pivot rows (FR-09) */
  tagIds: vine
    .array(vine.number().exists({ table: 'tags', column: 'id' }))
    .maxLength(10)
    .optional(),
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

/**
 * The restock action's dialog (FR-12)
 */
export const restockValidator = vine.create({
  quantity: vine.number().withoutDecimals().min(1).max(10000),
})
