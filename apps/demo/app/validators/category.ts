import vine from '@vinejs/vine'
import type Category from '#models/category'
import { labelled } from '#validators/messages'

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

const labels = { name: 'Name', slug: 'Slug', description: 'Description' }

const slugFormat = {
  'slug.regex': 'Slug may only contain lowercase letters, numbers and dashes',
}

export const createCategoryValidator = labelled(
  vine.create({
    ...fields,
    slug: slug().unique({ table: 'categories', column: 'slug' }),
  }),
  labels,
  slugFormat
)

export const updateCategoryValidator = labelled(
  vine.withMetaData<{ record: Category }>().create({
    ...fields,
    slug: slug().unique({
      table: 'categories',
      column: 'slug',
      filter: (query, _value, field) => {
        query.whereNot('id', field.meta.record.id)
      },
    }),
  }),
  labels,
  slugFormat
)
