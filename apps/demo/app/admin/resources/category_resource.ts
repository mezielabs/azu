import { column, defineResource, field } from '@mezielabs/azu'
import Category from '#models/category'
import CategoryPolicy from '#policies/category_policy'
import { createCategoryValidator, updateCategoryValidator } from '#validators/category'

export default defineResource(Category, {
  group: 'Catalog',
  icon: 'folder',
  title: 'name',
  search: ['name', 'slug'],
  policy: CategoryPolicy,
  validators: { create: createCategoryValidator, update: updateCategoryValidator },

  columns: [column.text('name').sortable(), column.text('slug')],
  fields: [
    field.text('name'),
    field.text('slug'),
    field.textarea('description'),
    field.hasMany('products'),
  ],
})
