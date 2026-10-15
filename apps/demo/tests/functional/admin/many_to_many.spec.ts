import { randomUUID } from 'node:crypto'
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import productResource from '#admin/resources/product_resource'
import Category from '#models/category'
import Product from '#models/product'
import Tag from '#models/tag'
import { createUser } from './helpers.ts'

const PRODUCTS = '/admin/resources/products'
const unique = () => randomUUID().slice(0, 8).toUpperCase()

async function catalog() {
  const prefix = unique()
  const category = await Category.create({ name: `Kitchen ${prefix}`, slug: `k-${prefix}` })
  const [clay, gift, sale] = await Tag.createMany(
    ['Clay', 'Gift', 'Sale'].map((name) => ({
      name: `${name} ${prefix}`,
      slug: `${name}-${prefix}`,
    }))
  )
  return { prefix, category, clay, gift, sale }
}

function payload(category: Category, overrides: Record<string, unknown> = {}) {
  return {
    name: 'Clay pot',
    sku: `M2M-${unique()}`,
    price: '12.50',
    status: 'draft' as const,
    categoryId: category.id,
    ...overrides,
  }
}

async function tagIds(product: Product) {
  await product.load('tags')
  return product.tags.map((tag) => tag.id).sort((a, b) => a - b)
}

test.group('Admin / manyToMany (FR-09)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('create attaches the submitted tags (tagIds)', async ({ client, assert }) => {
    const admin = await createUser('admin')
    const { category, clay, gift } = await catalog()

    const response = await client
      .post(`${PRODUCTS}/create`)
      .loginAs(admin)
      .withInertia()
      .withCsrfToken()
      .json(payload(category, { name: 'Tagged pot', tagIds: [clay.id, gift.id] }))
      .redirects(0)

    response.assertStatus(303)
    const product = await Product.findByOrFail('name', 'Tagged pot')
    assert.deepEqual(
      await tagIds(product),
      [clay.id, gift.id].sort((a, b) => a - b)
    )
  })

  test('edit replaces the set; repeats count once; an empty list detaches all', async ({
    client,
    assert,
  }) => {
    const admin = await createUser('admin')
    const { category, clay, gift, sale } = await catalog()
    const product = await Product.create({ ...payload(category), stock: 1, isFeatured: false })
    await product.related('tags').attach([clay.id, gift.id])

    const update = (tags: number[]) =>
      client
        .put(`${PRODUCTS}/${product.id}/edit`)
        .loginAs(admin)
        .withInertia()
        .withCsrfToken()
        .json(payload(category, { sku: product.sku, tagIds: tags }))
        .redirects(0)

    const replaced = await update([gift.id, sale.id, sale.id])
    replaced.assertStatus(303)
    assert.deepEqual(
      await tagIds(product),
      [gift.id, sale.id].sort((a, b) => a - b)
    )

    const emptied = await update([])
    emptied.assertStatus(303)
    assert.deepEqual(await tagIds(product), [])
  })

  test('leaving tagIds out leaves the tags as they are', async ({ client, assert }) => {
    const admin = await createUser('admin')
    const { category, clay } = await catalog()
    const product = await Product.create({ ...payload(category), stock: 1, isFeatured: false })
    await product.related('tags').attach([clay.id])

    const response = await client
      .put(`${PRODUCTS}/${product.id}/edit`)
      .loginAs(admin)
      .withInertia()
      .withCsrfToken()
      .json(payload(category, { sku: product.sku, name: 'Renamed pot' }))
      .redirects(0)

    response.assertStatus(303)
    assert.deepEqual(await tagIds(product), [clay.id])
  })

  test('a key that names no tag is a 422 under tagIds, and changes nothing', async ({
    client,
    assert,
  }) => {
    const admin = await createUser('admin')
    const { category, clay } = await catalog()
    const product = await Product.create({ ...payload(category), stock: 1, isFeatured: false })
    await product.related('tags').attach([clay.id])

    const response = await client
      .put(`${PRODUCTS}/${product.id}/edit`)
      .loginAs(admin)
      .withInertia()
      .withCsrfToken()
      .json(payload(category, { sku: product.sku, tagIds: [clay.id, 2147483000] }))
      .redirects(0)

    response.assertStatus(422)
    // The second key, the one with no tag
    assert.include(Object.keys(response.body().props.errors), 'tagIds.1')
    assert.deepEqual(await tagIds(product), [clay.id])
  })

  test('a failure after the sync rolls back the record and its tags', async ({
    client,
    assert,
  }) => {
    const admin = await createUser('admin')
    const { category, clay, gift } = await catalog()
    const product = await Product.create({ ...payload(category), stock: 1, isFeatured: false })
    await product.related('tags').attach([clay.id])

    const original = productResource.options.afterSave
    productResource.options.afterSave = () => {
      throw new Error('afterSave failed')
    }
    try {
      const response = await client
        .put(`${PRODUCTS}/${product.id}/edit`)
        .loginAs(admin)
        .withInertia()
        .withCsrfToken()
        .json(payload(category, { sku: product.sku, name: 'Never saved', tagIds: [gift.id] }))
        .redirects(0)
      response.assertStatus(500)
    } finally {
      productResource.options.afterSave = original
    }

    await product.refresh()
    assert.equal(product.name, 'Clay pot')
    assert.deepEqual(await tagIds(product), [clay.id])
  })

  test('the edit form and the detail page show the attached tags, linked', async ({
    client,
    assert,
  }) => {
    const admin = await createUser('admin')
    const { category, clay, gift } = await catalog()
    const product = await Product.create({ ...payload(category), stock: 1, isFeatured: false })
    await product.related('tags').attach([gift.id, clay.id])
    const expected = [clay, gift].map((tag) => ({
      id: tag.id,
      title: tag.name,
      href: `/admin/resources/tags/${tag.id}`,
    }))

    const edit = await client.get(`${PRODUCTS}/${product.id}/edit`).loginAs(admin).withInertia()
    const field = edit.body().props.form.fields.find((item: any) => item.name === 'tags')
    assert.containsSubset(field, {
      kind: 'manyToMany',
      input: 'tagIds',
      readOnly: false,
      optionsUrl: `${PRODUCTS}/fields/tags/options?record=${product.id}`,
    })
    // By title
    assert.deepEqual(edit.body().props.form.values.tags, expected)

    const show = await client.get(`${PRODUCTS}/${product.id}`).loginAs(admin).withInertia()
    assert.deepEqual(show.body().props.record.values.tags, expected)
  })

  test('options come from the field endpoint, searched by title', async ({ client, assert }) => {
    const admin = await createUser('admin')
    const { prefix, gift } = await catalog()

    const response = await client
      .get(`${PRODUCTS}/fields/tags/options?search=${encodeURIComponent(`Gift ${prefix}`)}`)
      .loginAs(admin)

    response.assertStatus(200)
    assert.deepEqual(response.body(), { options: [{ id: gift.id, title: gift.name }] })
  })

  test('forbidden: staff, who cannot list tags, get them read-only and cannot change them', async ({
    client,
    assert,
  }) => {
    // ProductPolicy.update lets staff edit; TagPolicy.viewList is admin-only
    const staff = await createUser('staff')
    const { category, clay, gift } = await catalog()
    const product = await Product.create({ ...payload(category), stock: 1, isFeatured: false })
    await product.related('tags').attach([clay.id])

    const edit = await client.get(`${PRODUCTS}/${product.id}/edit`).loginAs(staff).withInertia()
    const field = edit.body().props.form.fields.find((item: any) => item.name === 'tags')
    assert.containsSubset(field, { readOnly: true, optionsUrl: null })

    const options = await client
      .get(`${PRODUCTS}/fields/tags/options?record=${product.id}`)
      .loginAs(staff)
    options.assertStatus(403)

    const response = await client
      .put(`${PRODUCTS}/${product.id}/edit`)
      .loginAs(staff)
      .withInertia()
      .withCsrfToken()
      .json(payload(category, { sku: product.sku, tagIds: [gift.id] }))
      .redirects(0)
    response.assertStatus(303)
    assert.deepEqual(await tagIds(product), [clay.id])
  })
})
