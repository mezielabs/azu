/**
 * The README's Product resource, verbatim apart from the actions (from
 * the README's "Actions" section, plus a restock action), validator metadata (from its
 * "Validation" section), named form sections, a boolean filter, and the thumbnail's disk: the README stores it
 * on S3, the demo on Drive's default local disk so it runs offline.
 * Loaded by convention from app/admin/resources.
 */
import { defineResource, column, field, filter, action } from '@mezielabs/azu'
import Product from '#models/product'
import ProductPolicy from '#policies/product_policy'
import feature from '#admin/actions/feature'
import {
  createProductValidator,
  restockValidator,
  updateProductValidator,
} from '#validators/product'

export default defineResource(Product, {
  label: 'Products',
  group: 'Catalog',
  icon: 'package',
  order: 1,
  title: 'name',
  search: ['name', 'sku'],
  policy: ProductPolicy,
  validators: {
    create: createProductValidator,
    update: updateProductValidator,
    // From the README's "Validation" section: the update validator reads productId
    meta: ({ record }) => ({ productId: record?.id }),
  },
  query: (q) => q.preload('category'),

  columns: [
    column.image('thumbnail'),
    column.text('name').sortable(),
    column.decimal('price').format('currency', 'NGN').sortable(),
    column.belongsTo('category', 'name'),
    column.badge('status').colors({ draft: 'gray', published: 'green' }),
    // From the README's "Customising" section: inertia/admin/components/stock_bar.tsx
    column.custom('stock', 'StockBar').label('In stock'),
  ],

  fields: [
    field.text('name').section('Details'),
    // From the README's "Customising" section: inertia/admin/components/sku_input.tsx
    field.text('sku').section('Details').component('SkuInput'),
    field.decimal('price').section('Pricing').min(0),
    field.belongsTo('category').section('Organisation').searchable('name'),
    field.manyToMany('tags').section('Organisation').searchable('name'),
    field
      .select('status')
      .section('Organisation')
      .options({ draft: 'Draft', published: 'Published' }),
    field.richText('description').section('Media'),
    field.image('thumbnail').section('Media').maxSize('2mb'),
  ],

  filters: [
    filter.select('status', { draft: 'Draft', published: 'Published' }),
    filter.belongsTo('category'),
    filter.dateRange('createdAt'),
    filter.custom('Low stock', (q) => q.where('stock', '<', 10)),
    // Not in the README: a boolean filter (FR-13)
    filter.boolean('isFeatured').label('Featured'),
  ],

  // From the README's "Actions" section. FR-12 runs it; FR-03 only defines it.
  actions: [
    action
      .bulk('publish')
      .confirm('Publish the selected products?')
      .ability('publish')
      .handle(async (products, { trx }) => {
        await Product.query({ client: trx })
          .whereIn(
            'id',
            products.map((p) => p.id)
          )
          .update({ status: 'published' })

        return { message: `${products.length} products published` }
      }),
    // A dialog field, validated by its own VineJS validator
    action
      .row('restock')
      .ability('restock')
      .fields(
        [field.number('quantity').section('Stock adjustment').help('Added to the current stock')],
        restockValidator
      )
      .handle(async (product, { input }) => {
        product.stock += input.quantity
        await product.save()
        return { message: `${product.name} now has ${product.stock} in stock` }
      }),
    // A reusable action from azu:action
    feature,
  ],
})
