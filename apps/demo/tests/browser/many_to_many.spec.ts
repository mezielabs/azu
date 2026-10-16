import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Category from '#models/category'
import Product from '#models/product'
import Tag from '#models/tag'
import { createUser } from '../functional/admin/helpers.ts'

/**
 * The manyToMany picker (FR-09), by keyboard: search and add a tag,
 * remove one, save.
 */
test.group('manyToMany picker (FR-09)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('adds and removes tags from the keyboard, and saves the set', async ({
    visit,
    browserContext,
    assert,
  }) => {
    await browserContext.loginAs(await createUser('admin'))
    const category = await Category.create({ name: 'Kitchen', slug: 'kitchen-m2m' })
    const [clay, gift] = await Tag.createMany([
      { name: 'Clay', slug: 'clay-m2m' },
      { name: 'Gift', slug: 'gift-m2m' },
    ])
    const product = await Product.create({
      categoryId: category.id,
      name: 'Clay pot',
      sku: 'M2M-UI',
      price: '12.50',
      stock: 3,
      status: 'draft',
      isFeatured: false,
    })
    await product.related('tags').attach([clay.id])

    const page = await visit(`/admin/resources/products/${product.id}/edit`)
    const picker = page.locator('[data-azu-field="tags"]')
    await picker.locator('[role="row"]', { hasText: 'Clay' }).waitFor()

    // Search and add Gift; the search clears for the next one
    const search = picker.getByRole('combobox', { name: 'Add tags' })
    await search.fill('Gi')
    await page.locator('.azu-popover [role="option"]', { hasText: 'Gift' }).waitFor()
    await search.press('ArrowDown')
    await search.press('Enter')
    await picker.locator('[role="row"]', { hasText: 'Gift' }).waitFor()
    assert.equal(await search.inputValue(), '')

    // Close the options (they stay open for the next pick), then remove
    // Clay with its button, named for its tag
    await search.press('Escape')
    const remove = picker.getByRole('button', { name: 'Remove Clay', exact: true })
    await remove.click()
    await picker.locator('[role="row"]', { hasText: 'Clay' }).waitFor({ state: 'detached' })

    await page.click('form button[type="submit"]')
    await page.waitForURL(`**/admin/resources/products/${product.id}`)
    await product.load('tags')
    assert.deepEqual(
      product.tags.map((tag) => tag.id),
      [gift.id]
    )
  })

  test('past 200 attached, the picker is read-only, says why, and a save keeps them all', async ({
    visit,
    browserContext,
    assert,
  }) => {
    await browserContext.loginAs(await createUser('admin'))
    const category = await Category.create({ name: 'Kitchen', slug: 'kitchen-m2m-many' })
    const tags = await Tag.createMany(
      Array.from({ length: 250 }, (_, index) => ({
        name: `Bulk ${String(index).padStart(3, '0')}`,
        slug: `bulk-m2m-${index}`,
      }))
    )
    const product = await Product.create({
      categoryId: category.id,
      name: 'Clay pot',
      sku: 'M2M-MANY',
      price: '12.50',
      stock: 3,
      status: 'draft',
      isFeatured: false,
    })
    await product.related('tags').attach(tags.map((tag) => tag.id))

    const page = await visit(`/admin/resources/products/${product.id}/edit`)
    const picker = page.locator('[data-azu-field="tags"]')
    const tagGroup = picker.getByRole('grid', { name: 'Tags' })
    await tagGroup.waitFor()
    assert.equal(
      await tagGroup
        .getAttribute('aria-describedby')
        .then((ids) => page.locator(`[id="${ids}"]`).textContent()),
      '250 tags attached; too many to edit here'
    )
    assert.equal(await picker.getByRole('combobox').count(), 0)
    assert.equal(await picker.getByRole('button', { name: /^Remove/ }).count(), 0)

    await page.locator('[data-azu-field="name"] input').fill('Renamed pot')
    await page.click('form button[type="submit"]')
    await page.waitForURL(`**/admin/resources/products/${product.id}`)
    await product.refresh()
    await product.load('tags')
    assert.equal(product.name, 'Renamed pot')
    assert.lengthOf(product.tags, 250)
  })
})
