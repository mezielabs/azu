import { randomUUID } from 'node:crypto'
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import tagResource from '#admin/resources/tag_resource'
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

  test('scoped attachments stay read-only and survive omitted or forged selections', async ({
    client,
    assert,
    cleanup,
  }) => {
    const admin = await createUser('admin')
    const { category, clay, gift } = await catalog()
    const product = await Product.create({ ...payload(category), stock: 1, isFeatured: false })
    await product.related('tags').attach([clay.id, gift.id])
    const original = tagResource.options.query
    cleanup(() => {
      tagResource.options.query = original
    })

    for (const visibleIds of [[clay.id], []]) {
      tagResource.options.query = (query) => {
        query.whereIn('tags.id', visibleIds)
      }
      const edit = await client.get(`${PRODUCTS}/${product.id}/edit`).loginAs(admin).withInertia()
      const field = edit.body().props.form.fields.find((item: any) => item.name === 'tags')
      assert.containsSubset(field, { readOnly: true, optionsUrl: null })
      assert.include(field.readOnlyReason, 'outside this resource')
      assert.deepEqual(
        edit.body().props.form.values.tags.map((tag: any) => tag.id),
        visibleIds
      )
      const options = await client
        .get(`${PRODUCTS}/fields/tags/options?record=${product.id}`)
        .loginAs(admin)
      options.assertStatus(403)

      for (const selection of [{}, { tagIds: visibleIds }, { tagIds: [] }, { tagIds: '[]' }]) {
        const saved = await client
          .put(`${PRODUCTS}/${product.id}/edit`)
          .loginAs(admin)
          .withInertia()
          .withCsrfToken()
          .json(payload(category, { sku: product.sku, name: 'Renamed scoped pot', ...selection }))
          .redirects(0)
        saved.assertStatus(303)
        assert.deepEqual(
          await tagIds(product),
          [clay.id, gift.id].sort((a, b) => a - b)
        )
      }
    }
    await product.refresh()
    assert.equal(product.name, 'Renamed scoped pot')

    // A scope that includes the whole selection still permits editing.
    tagResource.options.query = (query) => {
      query.whereIn('tags.id', [clay.id, gift.id])
    }
    const edit = await client.get(`${PRODUCTS}/${product.id}/edit`).loginAs(admin).withInertia()
    assert.isFalse(edit.body().props.form.fields.find((item: any) => item.name === 'tags').readOnly)
    const saved = await client
      .put(`${PRODUCTS}/${product.id}/edit`)
      .loginAs(admin)
      .withInertia()
      .withCsrfToken()
      .json(payload(category, { sku: product.sku, tagIds: [gift.id] }))
      .redirects(0)
    saved.assertStatus(303)
    assert.deepEqual(await tagIds(product), [gift.id])
  })

  test('arbitrary strings are not decoded as relationship arrays', async ({ client, assert }) => {
    const admin = await createUser('admin')
    const { category, clay } = await catalog()
    const product = await Product.create({ ...payload(category), stock: 1, isFeatured: false })
    await product.related('tags').attach([clay.id])
    const response = await client
      .put(`${PRODUCTS}/${product.id}/edit`)
      .loginAs(admin)
      .withInertia()
      .withCsrfToken()
      .json(payload(category, { sku: product.sku, tagIds: `[${clay.id}]` }))
      .redirects(0)
    response.assertStatus(422)
    assert.property(response.body().props.errors, 'tagIds')
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
      readOnlyReason: null,
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

  test('past 200 attached, the edit form is read-only and an edit detaches none', async ({
    client,
    assert,
  }) => {
    const admin = await createUser('admin')
    const { prefix, category } = await catalog()
    const tags = await Tag.createMany(
      Array.from({ length: 250 }, (_, index) => ({
        name: `Bulk ${prefix} ${String(index).padStart(3, '0')}`,
        slug: `bulk-${prefix}-${index}`,
      }))
    )
    const product = await Product.create({ ...payload(category), stock: 1, isFeatured: false })
    await product.related('tags').attach(tags.map((tag) => tag.id))

    const edit = await client.get(`${PRODUCTS}/${product.id}/edit`).loginAs(admin).withInertia()
    const field = edit.body().props.form.fields.find((item: any) => item.name === 'tags')
    assert.containsSubset(field, {
      readOnly: true,
      optionsUrl: null,
      readOnlyReason: '250 tags attached; too many to edit here',
    })
    const shown: { id: number }[] = edit.body().props.form.values.tags
    assert.lengthOf(shown, 200)

    const options = await client
      .get(`${PRODUCTS}/fields/tags/options?record=${product.id}`)
      .loginAs(admin)
    options.assertStatus(403)

    // What the form sends: tagIds left out
    const renamed = await client
      .put(`${PRODUCTS}/${product.id}/edit`)
      .loginAs(admin)
      .withInertia()
      .withCsrfToken()
      .json(payload(category, { sku: product.sku, name: 'Renamed pot' }))
      .redirects(0)
    renamed.assertStatus(303)
    await product.refresh()
    assert.equal(product.name, 'Renamed pot')
    assert.lengthOf(await tagIds(product), 250)

    // A client that sends the 200 it was shown still detaches nothing
    const partial = await client
      .put(`${PRODUCTS}/${product.id}/edit`)
      .loginAs(admin)
      .withInertia()
      .withCsrfToken()
      .json(payload(category, { sku: product.sku, tagIds: shown.map((tag) => tag.id) }))
      .redirects(0)
    partial.assertStatus(303)
    assert.deepEqual(
      await tagIds(product),
      tags.map((tag) => tag.id).sort((a, b) => a - b)
    )
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
