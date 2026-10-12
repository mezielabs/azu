/**
 * The README's Product resource, verbatim apart from the actions
 * (from the README's "Actions" section). Loaded by convention from
 * app/admin/resources.
 */
import { defineResource, column, field, filter, action } from '@mezielabs/azu'
import Product from '#models/product'
import ProductPolicy from '#policies/product_policy'
import { createProductValidator, updateProductValidator } from '#validators/product'

export default defineResource(Product, {
  label: 'Products',
  group: 'Catalog',
  icon: 'package',
  title: 'name',
  search: ['name', 'sku'],
  policy: ProductPolicy,
  validators: { create: createProductValidator, update: updateProductValidator },
  query: (q) => q.preload('category'),

  columns: [
    column.image('thumbnail'),
    column.text('name').sortable(),
    column.decimal('price').format('currency', 'NGN').sortable(),
    column.belongsTo('category', 'name'),
    column.badge('status').colors({ draft: 'gray', published: 'green' }),
  ],

  fields: [
    field.text('name'),
    field.text('sku'),
    field.decimal('price').min(0),
    field.belongsTo('category').searchable('name'),
    field.select('status').options({ draft: 'Draft', published: 'Published' }),
    field.richText('description'),
    field.image('thumbnail').disk('s3').maxSize('2mb'),
  ],

  filters: [
    filter.select('status', { draft: 'Draft', published: 'Published' }),
    filter.dateRange('createdAt'),
    filter.custom('Low stock', (q) => q.where('stock', '<', 10)),
  ],

  // From the README's "Actions" section. FR-12 runs it; FR-03 only defines it.
  actions: [
    action
      .bulk('publish')
      .confirm('Publish the selected products?')
      .ability('publish')
      .handle(async (products) => {
        await Product.query()
          .whereIn(
            'id',
            products.map((p) => p.id)
          )
          .update({ status: 'published' })

        return { message: `${products.length} products published` }
      }),
  ],
})
