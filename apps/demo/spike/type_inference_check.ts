/**
 * SPIKE (Phase 0, risk check 1). Throwaway.
 *
 * Run `pnpm typecheck` in apps/demo. Every `@ts-expect-error` below must
 * produce an error, or tsc fails with "Unused '@ts-expect-error' directive".
 * So this file proves both directions: valid names compile, wrong ones don't.
 */
import { defineResource, column, field, filter, action } from '@mezielabs/azu/spike'
import Product from '#models/product'
import Order from '#models/order'
import User from '#models/user'
import ProductPolicy from '#policies/product_policy'
import { createProductValidator, updateProductValidator } from '#validators/product'
import { BaseModel, column as dbColumn } from '@adonisjs/lucid/orm'

/**
 * The README's Product resource, verbatim apart from the import path.
 */
export const productResource = defineResource(Product, {
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
    column.text('sku').component('SkuBadge'),
    column.number('price').format('currency', 'NGN').sortable(),
    column.belongsTo('category', 'name'),
    column.badge('status').colors({ draft: 'gray', published: 'green' }),
    column.datetime('createdAt').sortable().hiddenByDefault(),
    // Getters are fine as display columns
    column.boolean('isLowStock'),
  ],

  fields: [
    field.text('name'),
    field.text('sku'),
    field.number('price').min(0),
    field.belongsTo('category').searchable('name'),
    field.select('status').options({ draft: 'Draft', published: 'Published' }),
    field.richText('description'),
    field.image('thumbnail').disk('s3').maxSize('2mb'),
    field.manyToMany('tags').searchable('name'),
  ],

  filters: [
    filter.select('status', { draft: 'Draft', published: 'Published' }),
    filter.belongsTo('category'),
    filter.dateRange('createdAt'),
    filter.custom('Low stock', (q) => q.where('stock', '<', 10)),
  ],

  actions: [
    action
      .bulk('publish')
      .confirm('Publish the selected products?')
      .ability('publish')
      .handle(async (products) => {
        // `products` is Product[] here with no annotation
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

/**
 * Same machinery on other models, including a mixin-composed one (User).
 */
export const orderResource = defineResource(Order, {
  policy: ProductPolicy,
  title: 'number',
  columns: [column.text('number').sortable(), column.belongsTo('user', 'email')],
  fields: [field.belongsTo('user').searchable('email')],
})

export const userResource = defineResource(User, {
  policy: ProductPolicy,
  title: 'email',
  columns: [column.text('email').sortable(), column.text('initials')],
})

/**
 * Mistakes that must fail tsc.
 */
export const mistakes = defineResource(Product, {
  policy: ProductPolicy,
  // @ts-expect-error misspelled title
  title: 'nmae',
  // @ts-expect-error search on a getter, which can't be SQL
  search: ['name', 'isLowStock'],
  query: (q) =>
    // @ts-expect-error misspelled relation in the query hook (Lucid's own typing)
    q.preload('categroy'),

  columns: [
    // @ts-expect-error misspelled column
    column.text('nmae'),
    // @ts-expect-error misspelled column inside a chain
    column.text('nmae').sortable(),
    // @ts-expect-error wrong type: price is a number, not a string
    column.text('price'),
    // @ts-expect-error sorting on a getter
    column.boolean('isLowStock').sortable(),
    // @ts-expect-error relation name misspelled
    column.belongsTo('categroy', 'name'),
    // @ts-expect-error title column missing on the related model (Category)
    column.belongsTo('category', 'sku'),
    // @ts-expect-error hasMany is not a belongsTo
    column.belongsTo('orderItems', 'id'),
  ],

  fields: [
    // @ts-expect-error misspelled field
    field.text('nmae'),
    // @ts-expect-error getters can't be form fields
    field.boolean('isLowStock'),
    // @ts-expect-error searchable column missing on Tag
    field.manyToMany('tags').searchable('title'),
    // @ts-expect-error relation passed to a scalar field
    field.text('category'),
  ],

  filters: [
    // @ts-expect-error dateRange on a non-date column
    filter.dateRange('name'),
    // @ts-expect-error misspelled filter column
    filter.select('statuss', {}),
  ],

  actions: [
    // @ts-expect-error ability not defined on ProductPolicy
    action
      .bulk('archive')
      .ability('archive')
      .handle(async () => {}),
    action
      .bulk('touch')
      .ability('update')
      .handle(async (products) => {
        // @ts-expect-error products are typed: no such attribute
        products.map((p) => p.nmae)
      }),
  ],
})

/**
 * A hand-written model with no generated `$columns`. Names are still
 * checked, but getters can't be told apart from columns, so a sortable
 * getter slips through. Generated schema classes (the AdonisJS 7 default)
 * don't have this gap.
 */
class Note extends BaseModel {
  @dbColumn({ isPrimary: true })
  declare id: number

  @dbColumn()
  declare body: string

  get excerpt() {
    return this.body.slice(0, 20)
  }
}

export const noteResource = defineResource(Note, {
  policy: ProductPolicy,
  columns: [
    column.text('body').sortable(),
    // Known gap without $columns: compiles, would fail at runtime
    column.text('excerpt').sortable(),
    // @ts-expect-error misspellings are still caught
    column.text('bdy'),
  ],
})
