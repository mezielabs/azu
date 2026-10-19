/**
 * Type tests for defineResource (FR-03), run by `pnpm typecheck`.
 *
 * Every `@ts-expect-error` must produce an error, or tsc fails with
 * "Unused '@ts-expect-error' directive". So this file proves both
 * directions: valid names compile, and each mistake doesn't. Ported from
 * the Phase 0 spike (docs/spike-findings.md, check 1), plus decimals.
 */
import { BasePolicy } from '@adonisjs/bouncer'
import { BaseModel, column as dbColumn } from '@adonisjs/lucid/orm'
import { action, column, defineResource, field, filter } from '@mezielabs/azu'
import Order from '#models/order'
import Product from '#models/product'
import User from '#models/user'
import ProductPolicy from '#policies/product_policy'
import { restockValidator } from '#validators/product'
import markAsPaid from './generated_action.ts'

/**
 * Valid definitions beyond the README's, on other models, including a
 * mixin-composed one (User) and typed handlers and queries.
 */
export const valid = [
  defineResource(Order, {
    policy: ProductPolicy,
    title: 'number',
    search: ['number'],
    columns: [
      column.text('number').sortable(),
      column.decimal('total').format('currency', 'NGN').sortable(),
      column.belongsTo('user', 'email'),
      column.datetime('placedAt').sortable().hiddenByDefault(),
    ],
    fields: [field.belongsTo('user').searchable('email'), field.decimal('total').min('0.00')],
  }),
  defineResource(User, {
    policy: ProductPolicy,
    title: 'email',
    columns: [
      column.text('email').sortable(),
      column.text('initials'),
      column.custom('role', 'RoleBadge'),
    ],
  }),
  defineResource(Product, {
    policy: ProductPolicy,
    columns: [column.number('stock').sortable(), column.boolean('isLowStock')],
    fields: [
      field.number('stock').min(0).step(1),
      field.boolean('isFeatured'),
      field.datetime('publishedAt'),
      field.manyToMany('tags').searchable('name'),
      field.hasMany('orderItems'),
      field.text('sku').prefix('#').ability('update'),
    ],
    filters: [
      filter.boolean('isFeatured'),
      filter.belongsTo('category'),
      // The query is typed against Product with no annotation
      filter.custom('Featured', (q) => q.where('isFeatured', true).preload('category')),
    ],
    actions: [
      action
        .row('feature')
        .ability('update')
        .handle(async (product) => {
          // `product` is a Product, not Product[]
          product.isFeatured = true
          await product.save()
        }),
      action
        .row('restock')
        .ability('restock')
        .fields([field.number('quantity')], restockValidator)
        .handle(async (product, { input, trx }) => {
          // `input` is the validator's output; `trx` takes the query
          const quantity: number = input.quantity
          await Product.query({ client: trx }).where('id', product.id).increment('stock', quantity)
        }),
    ],
  }),
]

/**
 * azu:action's output, unedited (generated_action.ts), plugs
 * into any resource whose policy has its ability.
 */
class PaymentPolicy extends BasePolicy {
  markAsPaid() {
    return true
  }
}

export const generated = defineResource(Order, {
  policy: PaymentPolicy,
  title: 'number',
  actions: [markAsPaid],
})

export const generatedMistake = defineResource(Order, {
  policy: ProductPolicy,
  title: 'number',
  // @ts-expect-error ProductPolicy has no markAsPaid method
  actions: [markAsPaid],
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
    // @ts-expect-error wrong type: stock is a number, not a string
    column.text('stock'),
    // @ts-expect-error decimals are strings: number() can't take price
    column.number('price'),
    // @ts-expect-error decimal() needs a string attribute
    column.decimal('stock'),
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
    // @ts-expect-error decimals are strings: number() can't take price
    field.number('price'),
    // @ts-expect-error tags is manyToMany, not belongsTo
    field.belongsTo('tags'),
    // @ts-expect-error ability not defined on ProductPolicy
    field.text('sku').ability('archive'),
  ],

  filters: [
    // @ts-expect-error dateRange on a non-date column
    filter.dateRange('name'),
    // @ts-expect-error misspelled filter column
    filter.select('statuss', {}),
    // @ts-expect-error the custom query is typed: misspelled relation
    filter.custom('Broken', (q) => q.preload('categroy')),
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
    action
      .row('restock')
      .ability('restock')
      .fields([field.number('quantity')], restockValidator)
      .handle(async (_product, { input }) => {
        // @ts-expect-error the input is typed by the validator: no such field
        return { message: String(input.qty) }
      }),
    action
      .row('attach')
      .ability('update')
      // @ts-expect-error a dialog can't show file fields
      .fields([field.file('thumbnail')], restockValidator),
  ],
})

/**
 * Builder methods only exist for the kinds they make sense for.
 */
// @ts-expect-error format() is for number and decimal columns
column.text('name').format('currency')
// @ts-expect-error colors() is for badge columns
column.text('name').colors({})
// @ts-expect-error belongsTo columns can't be sorted (that needs a join)
column.belongsTo('category', 'name').sortable()
// @ts-expect-error options() is for select fields
field.text('name').options({})
// @ts-expect-error min() is for number and decimal fields
field.text('name').min(0)
// @ts-expect-error disk() is for file and image fields
field.text('name').disk('s3')
// @ts-expect-error searchable() is for relation fields
field.text('name').searchable('name')

/**
 * A hand-written model with no generated `$columns`. Names are still
 * checked, but getters can't be told apart from columns, so a sortable
 * getter slips through. Generated schema classes don't have this gap.
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

export const note = defineResource(Note, {
  policy: ProductPolicy,
  columns: [
    column.text('body').sortable(),
    // Known gap without $columns: compiles, would fail at runtime
    column.text('excerpt').sortable(),
    // @ts-expect-error misspellings are still caught
    column.text('bdy'),
  ],
})
