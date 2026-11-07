/**
 * Products in the demo store, loaded by convention from
 * app/admin/resources. The thumbnail uses Drive's default local disk, so
 * the demo runs offline.
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
  // #region options
  label: 'Products',
  group: 'Catalog',
  icon: 'package',
  order: 1,
  title: 'name',
  search: ['name', 'sku'],
  policy: ProductPolicy,
  // #region validators
  validators: {
    create: createProductValidator,
    update: updateProductValidator,
    // The update validator's unique rule reads productId
    meta: ({ record }) => ({ productId: record?.id }),
  },
  // #endregion
  query: (q) => q.preload('category'),
  // #endregion

  // #region columns
  columns: [
    column.image('thumbnail'),
    column.text('name').sortable(),
    column.decimal('price').format('currency', 'NGN').sortable(),
    column.belongsTo('category', 'name'),
    column.badge('status').colors({ draft: 'gray', published: 'green' }),
    // #region stock-column
    // inertia/admin/components/stock_bar.tsx
    column.custom('stock', 'StockBar').label('In stock'),
    // #endregion
    column.text('sku').hiddenByDefault(),
  ],
  // #endregion

  // #region fields
  fields: [
    field.text('name').section('Details'),
    // #region sku-field
    // inertia/admin/components/sku_input.tsx
    field.text('sku').component('SkuInput').section('Details'),
    // #endregion
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
  // #endregion

  // #region filters
  filters: [
    filter.select('status', { draft: 'Draft', published: 'Published' }),
    filter.belongsTo('category'),
    filter.dateRange('createdAt'),
    filter.custom('Low stock', (q) => q.where('stock', '<', 10)),
    filter.boolean('isFeatured').label('Featured'),
  ],
  // #endregion

  // #region actions
  actions: [
    // #region publish-action
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
    // #endregion
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
  // #endregion
})
