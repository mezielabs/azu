import vine from '@vinejs/vine'
import type Category from '#models/category'

const fields = {
  name: vine.string().trim().minLength(2).maxLength(100),
  description: vine.string().trim().nullable().optional(),
}

const slug = () =>
  vine
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/)
    .maxLength(120)

export const createCategoryValidator = vine.create({
  ...fields,
  slug: slug().unique({ table: 'categories', column: 'slug' }),
})

export const updateCategoryValidator = vine.withMetaData<{ record: Category }>().create({
  ...fields,
  slug: slug().unique({
    table: 'categories',
    column: 'slug',
    filter: (query, _value, field) => {
      query.whereNot('id', field.meta.record.id)
    },
  }),
})
