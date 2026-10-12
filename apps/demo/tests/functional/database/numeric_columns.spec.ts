import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import Category from '#models/category'
import Product from '#models/product'

/**
 * Pins down what each database driver returns for numeric data, so a
 * driver or Lucid upgrade that changes it fails CI. See the 2026-10-12
 * "decimal columns" entry in docs/decisions.md.
 *
 * database/schema.ts is generated from Postgres, so the models declare
 * decimals as `string`. SQLite still returns numbers at runtime, so these
 * assertions read values through `unknown` rather than trusting the
 * declared type.
 */
test.group('Numeric columns', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  const dialect = () => db.connection().dialect.name

  async function createProduct(price: string) {
    const category = await Category.create({ name: 'Kitchen', slug: 'kitchen' })
    return Product.create({
      categoryId: category.id,
      name: 'Pot',
      sku: 'SKU-1',
      price,
      stock: 3,
      status: 'draft',
      isFeatured: false,
    })
  }

  test('decimal(12,2) through a Lucid model', async ({ assert }) => {
    const { id } = await createProduct('1750.50')
    const product = await Product.findOrFail(id)
    const price: unknown = product.price

    if (dialect() === 'postgres') {
      assert.strictEqual(price, '1750.50')
    } else {
      assert.strictEqual(price, 1750.5)
    }
  })

  test('decimal(12,2) through the query builder', async ({ assert }) => {
    await createProduct('99.90')
    const row = await db.from('products').select('price').firstOrFail()

    if (dialect() === 'postgres') {
      assert.strictEqual(row.price, '99.90')
    } else {
      assert.strictEqual(row.price, 99.9)
    }
  })

  test('count(*) and sum() aggregates', async ({ assert }) => {
    await createProduct('10.25')
    const row = await db.from('products').count('* as total').sum('price as revenue').firstOrFail()

    if (dialect() === 'postgres') {
      // bigint and numeric: both strings from node-postgres
      assert.strictEqual(row.total, '1')
      assert.strictEqual(row.revenue, '10.25')
    } else {
      assert.strictEqual(row.total, 1)
      assert.strictEqual(row.revenue, 10.25)
    }
  })

  test('paginator totals are numbers on every database', async ({ assert }) => {
    await createProduct('5.00')
    const page = await Product.query().paginate(1, 10)

    assert.strictEqual(page.total, 1)
    assert.strictEqual(page.getMeta().total, 1)
  })

  test('integer columns are numbers on every database', async ({ assert }) => {
    const { id } = await createProduct('5.00')
    const product = await Product.findOrFail(id)

    assert.strictEqual(product.stock, 3)
    assert.strictEqual(typeof product.id, 'number')
  })
})
