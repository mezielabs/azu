import { randomUUID } from 'node:crypto'
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import Category from '#models/category'
import Coupon from '#models/coupon'
import Product from '#models/product'
import { createUser } from './helpers.ts'

const PRODUCTS = '/admin/resources/products'
const OPTIONS = `${PRODUCTS}/fields/category/options`

/**
 * Categories named "<prefix> <name>", so a search for the prefix scopes
 * a test to its own rows, even on a seeded database.
 */
async function createCategories(...names: string[]) {
  const prefix = `t${randomUUID().slice(0, 6)}`
  const categories = await Category.createMany(
    names.map((name, index) => ({ name: `${prefix} ${name}`, slug: `${prefix}-${index}` }))
  )
  return { prefix, categories }
}

async function createProduct(category: Category, overrides: Partial<Product> = {}) {
  return Product.create({
    categoryId: category.id,
    name: 'Clay pot',
    sku: `T-${randomUUID().slice(0, 8)}`.toUpperCase(),
    price: '5.00',
    stock: 1,
    status: 'draft',
    isFeatured: false,
    ...overrides,
  })
}

/**
 * Counts SQL queries while `run` executes.
 */
async function countQueries(run: () => Promise<unknown>) {
  const knex = db.connection().getWriteClient()
  let count = 0
  const listener = () => count++
  knex.on('query', listener)
  try {
    await run()
  } finally {
    knex.off('query', listener)
  }
  return count
}

test.group('Admin / belongsTo fields (FR-08)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('the field submits its foreign key, with hints from the validator', async ({
    client,
    assert,
  }) => {
    const admin = await createUser('admin')
    const response = await client.get(`${PRODUCTS}/create`).loginAs(admin).withInertia()

    const { form } = response.body().props
    const category = form.fields.find((field: any) => field.name === 'category')
    assert.containsSubset(category, {
      kind: 'belongsTo',
      input: 'categoryId',
      required: true,
      optionsUrl: OPTIONS,
    })
    assert.isNull(form.values.category)
  })

  test('options search the title attribute, literally', async ({ client, assert }) => {
    const admin = await createUser('admin')
    const { prefix, categories } = await createCategories('Pots 50% off', 'Pots 500', 'Bowls')

    const response = await client
      .get(`${OPTIONS}?search=${encodeURIComponent(`${prefix} pots 50%`)}`)
      .loginAs(admin)
    response.assertStatus(200)
    assert.deepEqual(response.body(), {
      options: [{ id: categories[0].id, title: `${prefix} Pots 50% off` }],
    })

    const all = await client.get(`${OPTIONS}?search=${prefix}`).loginAs(admin)
    // Sorted by title. The two "Pots" names compare differently under
    // each database's collation, so only Bowls' place is checked
    const titles = all.body().options.map((option: any) => option.title)
    assert.equal(titles[0], `${prefix} Bowls`)
    assert.sameMembers(titles, [`${prefix} Bowls`, `${prefix} Pots 50% off`, `${prefix} Pots 500`])
  })

  test('options are capped at 20', async ({ client, assert }) => {
    const admin = await createUser('admin')
    const { prefix } = await createCategories(
      ...Array.from({ length: 25 }, (_, i) => `c${String(i).padStart(2, '0')}`)
    )

    const response = await client.get(`${OPTIONS}?search=${prefix}`).loginAs(admin)
    assert.lengthOf(response.body().options, 20)
  })

  test('options follow the form: create, or update on the named record', async ({
    client,
    assert,
  }) => {
    const admin = await createUser('admin')
    const { categories } = await createCategories('Kitchen')
    const product = await createProduct(categories[0])

    const forCreate = await client.get(OPTIONS).loginAs(admin)
    forCreate.assertStatus(200)
    const forEdit = await client.get(`${OPTIONS}?record=${product.id}`).loginAs(admin)
    forEdit.assertStatus(200)
    assert.isArray(forEdit.body().options)
  })

  test('options need the related viewList: staff may edit products, not list categories', async ({
    client,
  }) => {
    const staff = await createUser('staff')
    const { categories } = await createCategories('Kitchen')
    const product = await createProduct(categories[0])

    // ProductPolicy.update allows staff; CategoryPolicy.viewList doesn't
    const forEdit = await client.get(`${OPTIONS}?record=${product.id}`).loginAs(staff)
    forEdit.assertStatus(403)
    // ProductPolicy.create doesn't allow staff either
    const forCreate = await client.get(OPTIONS).loginAs(staff)
    forCreate.assertStatus(403)
  })

  test('without the related viewList, the field is read-only on the form', async ({
    client,
    assert,
  }) => {
    const staff = await createUser('staff')
    const { prefix, categories } = await createCategories('Kitchen')
    const product = await createProduct(categories[0])

    const response = await client.get(`${PRODUCTS}/${product.id}/edit`).loginAs(staff).withInertia()

    const { form } = response.body().props
    const category = form.fields.find((field: any) => field.name === 'category')
    assert.containsSubset(category, { readOnly: true, optionsUrl: null, input: 'categoryId' })
    // It still shows the current category, without a link
    assert.deepEqual(form.values.category, {
      id: categories[0].id,
      title: `${prefix} Kitchen`,
      href: null,
    })
  })

  test('staff save a product, and its category stays what it was', async ({ client, assert }) => {
    const staff = await createUser('staff')
    const { categories } = await createCategories('Kitchen', 'Books')
    const product = await createProduct(categories[0])

    // A crafted request tries to move it anyway
    const response = await client
      .put(`${PRODUCTS}/${product.id}/edit`)
      .loginAs(staff)
      .withInertia()
      .withCsrfToken()
      .json({
        name: 'Clay pot, renamed',
        sku: product.sku,
        price: '5.00',
        categoryId: categories[1].id,
        status: 'draft',
      })
      .redirects(0)

    // The update validator requires categoryId; it got the current one
    response.assertStatus(303)
    await product.refresh()
    assert.equal(product.name, 'Clay pot, renamed')
    assert.equal(product.categoryId, categories[0].id)
  })

  test('options need a belongsTo field on that form', async ({ client }) => {
    const admin = await createUser('admin')

    for (const url of [
      `${PRODUCTS}/fields/name/options`,
      `${PRODUCTS}/fields/nope/options`,
      '/admin/resources/nope/fields/category/options',
      `${OPTIONS}?record=2147483000`,
    ]) {
      const response = await client.get(url).loginAs(admin)
      response.assertStatus(404)
    }
  })

  test('guests get no options', async ({ client }) => {
    const response = await client.get(OPTIONS).redirects(0)
    response.assertStatus(302)
  })

  test('the README Product resource creates end to end', async ({ client, assert }) => {
    const admin = await createUser('admin')
    const { categories } = await createCategories('Kitchen')
    const sku = `T-${randomUUID().slice(0, 8)}`.toUpperCase()

    const response = await client
      .post(`${PRODUCTS}/create`)
      .loginAs(admin)
      .withInertia()
      .withCsrfToken()
      .json({
        name: 'Clay pot',
        sku: sku.toLowerCase(),
        price: '1750.50',
        categoryId: categories[0].id,
        status: 'published',
      })
      .redirects(0)

    response.assertStatus(303)
    const product = await Product.findByOrFail('sku', sku)
    assert.equal(response.header('location'), `${PRODUCTS}/${product.id}`)
    assert.equal(product.categoryId, categories[0].id)
    assert.equal(product.status, 'published')
    // Not a form field: the column's default
    assert.equal(product.stock, 0)
  })

  test('an unknown category is an error under the field', async ({ client, assert }) => {
    const admin = await createUser('admin')
    const response = await client
      .post(`${PRODUCTS}/create`)
      .loginAs(admin)
      .withInertia()
      .withCsrfToken()
      .json({
        name: 'Clay pot',
        sku: 'T-NOPE',
        price: '1.00',
        categoryId: 2147483000,
        status: 'draft',
      })

    response.assertStatus(422)
    assert.deepEqual(Object.keys(response.body().props.errors), ['categoryId'])
  })

  test('the edit form seeds the current category', async ({ client, assert }) => {
    const admin = await createUser('admin')
    const { prefix, categories } = await createCategories('Kitchen')
    const product = await createProduct(categories[0])

    const response = await client.get(`${PRODUCTS}/${product.id}/edit`).loginAs(admin).withInertia()

    const { form } = response.body().props
    assert.deepEqual(form.values.category, {
      id: categories[0].id,
      title: `${prefix} Kitchen`,
      href: `/admin/resources/categories/${categories[0].id}`,
    })
    const category = form.fields.find((field: any) => field.name === 'category')
    assert.equal(category.optionsUrl, `${OPTIONS}?record=${product.id}`)
  })

  test('the README Product resource updates end to end, with mapped metadata', async ({
    client,
    assert,
  }) => {
    const admin = await createUser('admin')
    const { categories } = await createCategories('Kitchen', 'Books')
    const product = await createProduct(categories[0], { stock: 7 })

    // Keeping its own SKU passes the unique rule, which skips meta.productId
    const response = await client
      .put(`${PRODUCTS}/${product.id}/edit`)
      .loginAs(admin)
      .withInertia()
      .withCsrfToken()
      .json({
        name: 'Clay pot, large',
        sku: product.sku,
        price: '6.00',
        categoryId: categories[1].id,
        status: 'published',
      })
      .redirects(0)

    response.assertStatus(303)
    await product.refresh()
    assert.equal(product.name, 'Clay pot, large')
    assert.equal(product.categoryId, categories[1].id)
    // Not a form field, so untouched
    assert.equal(product.stock, 7)
  })

  test('the detail page links the category for users who may view it', async ({
    client,
    assert,
  }) => {
    const [admin, staff] = [await createUser('admin'), await createUser('staff')]
    const { categories } = await createCategories('Kitchen')
    const product = await createProduct(categories[0])

    const asAdmin = await client.get(`${PRODUCTS}/${product.id}`).loginAs(admin).withInertia()
    const { fields, record } = asAdmin.body().props
    assert.include(
      fields.map((field: any) => field.name),
      'category'
    )
    assert.equal(record.values.category.href, `/admin/resources/categories/${categories[0].id}`)

    // CategoryPolicy.view is admin-only: the title shows, unlinked
    const asStaff = await client.get(`${PRODUCTS}/${product.id}`).loginAs(staff).withInertia()
    assert.isNull(asStaff.body().props.record.values.category.href)
  })
})

test.group('Admin / optional belongsTo fields (FR-08)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  const COUPONS = '/admin/resources/coupons'

  function couponPayload(code: string, categoryId: number | null) {
    return {
      code,
      kind: 'percent',
      amount: '10.00',
      currency: 'NGN',
      isActive: true,
      startsOn: '2026-10-01',
      categoryId,
    }
  }

  test('an optional relation is not required, and saves empty', async ({ client, assert }) => {
    const admin = await createUser('admin')
    const page = await client.get(`${COUPONS}/create`).loginAs(admin).withInertia()
    const field = page.body().props.form.fields.find((item: any) => item.name === 'category')
    assert.containsSubset(field, { input: 'categoryId', required: false })

    const code = `T${randomUUID().slice(0, 8).toUpperCase()}`
    const response = await client
      .post(`${COUPONS}/create`)
      .loginAs(admin)
      .withInertia()
      .withCsrfToken()
      .json(couponPayload(code, null))
      .redirects(0)

    response.assertStatus(303)
    const coupon = await Coupon.findByOrFail('code', code)
    assert.isNull(coupon.categoryId)
  })

  test('clearing the relation on edit stores null', async ({ client, assert }) => {
    const admin = await createUser('admin')
    const { categories } = await createCategories('Kitchen')
    const coupon = await Coupon.create({
      code: `T${randomUUID().slice(0, 8).toUpperCase()}`,
      kind: 'percent',
      amount: '10.00',
      currency: 'NGN',
      isActive: true,
      startsOn: DateTime.fromISO('2026-10-01'),
      categoryId: categories[0].id,
    })

    const response = await client
      .put(`${COUPONS}/${coupon.id}/edit`)
      .loginAs(admin)
      .withInertia()
      .withCsrfToken()
      .json(couponPayload(coupon.code, null))
      .redirects(0)

    response.assertStatus(303)
    await coupon.refresh()
    assert.isNull(coupon.categoryId)
  })
})

test.group('Admin / hasMany tables (FR-08)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test("a category's detail page pages through its products", async ({ client, assert }) => {
    const admin = await createUser('admin')
    const { categories } = await createCategories('Kitchen', 'Books')
    for (let i = 1; i <= 12; i++) {
      await createProduct(categories[0], { name: `Pot ${String(i).padStart(2, '0')}` })
    }
    await createProduct(categories[1], { name: 'Not in this category' })

    const first = await client
      .get(`/admin/resources/categories/${categories[0].id}`)
      .loginAs(admin)
      .withInertia()
    first.assertStatus(200)
    const [table] = first.body().props.relations
    assert.containsSubset(table, {
      name: 'products',
      label: 'Products',
      resource: 'products',
      titleColumn: 'name',
      pageParam: 'productsPage',
      meta: { total: 12, perPage: 10, currentPage: 1, lastPage: 2 },
    })
    assert.lengthOf(table.rows, 10)
    assert.isTrue(table.columns.every((column: any) => column.sortable === false))
    assert.deepEqual(table.rows[0].abilities, { view: true })

    const second = await client
      .get(`/admin/resources/categories/${categories[0].id}?productsPage=2`)
      .loginAs(admin)
      .withInertia()
    const [page2] = second.body().props.relations
    assert.lengthOf(page2.rows, 2)
    assert.notInclude(
      page2.rows.map((row: any) => row.title),
      'Not in this category'
    )
  })

  test('the table preloads its belongsTo columns (no N+1)', async ({ client, assert }) => {
    const admin = await createUser('admin')
    const { categories } = await createCategories('Few', 'Many')
    await createProduct(categories[0])
    for (let i = 0; i < 10; i++) await createProduct(categories[1])

    const visit = (category: Category) =>
      countQueries(() =>
        client.get(`/admin/resources/categories/${category.id}`).loginAs(admin).withInertia()
      )

    assert.equal(await visit(categories[1]), await visit(categories[0]))
  })
})
