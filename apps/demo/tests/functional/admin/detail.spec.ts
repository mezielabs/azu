import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import Category from '#models/category'
import Order from '#models/order'
import Product from '#models/product'
import { createUser } from './helpers.ts'

test.group('Admin / detail page props (layout 3/4)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('the record card gets the timestamps; with fields, no fallback cells', async ({
    client,
    assert,
  }) => {
    const admin = await createUser('admin')
    const category = await Category.create({ name: 'Kitchen', slug: 'kitchen-detail' })
    const product = await Product.create({
      categoryId: category.id,
      name: 'Clay pot',
      sku: 'DETAIL-1',
      price: '5.00',
      stock: 2,
      status: 'draft',
      isFeatured: false,
    })

    const response = await client
      .get(`/admin/resources/products/${product.id}`)
      .loginAs(admin)
      .withInertia()

    const props = response.body().props
    // As stored: the database keeps whole seconds
    await product.refresh()
    assert.deepEqual(props.timestamps, {
      createdAt: product.createdAt.toISO(),
      updatedAt: product.updatedAt!.toISO(),
    })
    assert.isNull(props.cells)
  })

  test('a hasMany table leaves out the column back to the parent; the list keeps it', async ({
    client,
    assert,
  }) => {
    const admin = await createUser('admin')
    const category = await Category.create({ name: 'Kitchen', slug: 'kitchen-parent-column' })
    await Product.create({
      categoryId: category.id,
      name: 'Clay pot',
      sku: 'DETAIL-PARENT',
      price: '5.00',
      stock: 2,
      status: 'draft',
      isFeatured: false,
    })

    const detail = await client
      .get(`/admin/resources/categories/${category.id}`)
      .loginAs(admin)
      .withInertia()
    const products = detail.body().props.relations.find((table: any) => table.name === 'products')
    const names = products.columns.map((column: any) => column.name)
    // products.categoryId is category.products' foreign key
    assert.notInclude(names, 'category')
    assert.includeMembers(names, ['name', 'price', 'status'])

    const list = await client.get('/admin/resources/products').loginAs(admin).withInertia()
    assert.include(
      list.body().props.resource.columns.map((column: any) => column.name),
      'category'
    )
  })

  test('with no fields (Orders), the page gets the columns instead', async ({ client, assert }) => {
    const admin = await createUser('admin')
    const customer = await createUser('customer')
    const order = await Order.create({
      userId: customer.id,
      number: 'DETAIL-ORDER',
      status: 'shipped',
      total: '12.50',
      placedAt: DateTime.fromISO('2026-10-01T10:00:00Z'),
    })

    const response = await client
      .get(`/admin/resources/orders/${order.id}`)
      .loginAs(admin)
      .withInertia()

    const props = response.body().props
    assert.deepEqual(props.fields, [])
    assert.containsSubset(props.cells, {
      number: 'DETAIL-ORDER',
      status: 'shipped',
      // The belongsTo column's relation was loaded for it
      user: { id: customer.id, title: customer.email },
    })
    // A decimal: an exact string, though SQLite drops the trailing zero
    assert.equal(Number(props.cells.total), 12.5)
  })
})
