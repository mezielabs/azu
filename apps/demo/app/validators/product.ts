import vine from '@vinejs/vine'

const fields = {
  name: vine.string().trim().minLength(2).maxLength(160),
  description: vine.string().trim().nullable().optional(),
  price: vine.number().min(0).max(1_000_000).decimal([0, 2]),
  stock: vine.number().withoutDecimals().min(0),
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
