import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Category from '#models/category'
import Product from '#models/product'
import Tag from '#models/tag'
import { createUser } from '../functional/admin/helpers.ts'
import { axeViolations } from './axe.ts'

const CATEGORIES = '/admin/resources/categories'

const focused = (page: any) =>
  page.evaluate(() => {
    const element = (globalThis as any).document.activeElement
    return {
      field: element?.closest('[data-azu-field]')?.getAttribute('data-azu-field') ?? null,
      after: element?.getAttribute('data-azu-after') ?? null,
    }
  })

/**
 * "Create & add another" and "Save & keep editing" (layout 4/4): a save
 * that comes back to a form, through `_after`.
 */
test.group('Save and come back', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('Create & add another, twice: a fresh form each time, and a toast that links to the record', async ({
    visit,
    browserContext,
    assert,
  }) => {
    await browserContext.loginAs(await createUser('admin'))
    const page = await visit(`${CATEGORIES}/create`)
    const bar = page.locator('.azu-save-bar')
    assert.deepEqual(await bar.locator('.azu-save-actions > *').allInnerTexts(), [
      'Cancel',
      'Create & add another',
      'Create',
    ])
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      assert.deepEqual(await axeViolations(page), [], `create form, ${colorScheme}`)
    }

    const name = page.locator('[data-azu-field="name"] input')
    const slug = page.locator('[data-azu-field="slug"] input')
    for (const [label, key] of [
      ['Pots', 'pots-another'],
      ['Pans', 'pans-another'],
    ]) {
      await name.fill(label)
      await slug.fill(key)
      await page.evaluate(() => (globalThis as any).scrollTo(0, 400))
      await bar.getByRole('button', { name: 'Create & add another' }).click()
      const toast = page.locator('.azu-toast', { hasText: 'Category created' }).last()
      await toast.waitFor()
      await page.waitForFunction(
        () =>
          (globalThis as any).document.querySelector('[data-azu-field="name"] input')?.value === ''
      )
      assert.match(page.url(), /\/categories\/create$/)
      assert.deepEqual(await focused(page), { field: 'name', after: null })
      assert.equal(await page.evaluate(() => (globalThis as any).scrollY), 0)
      // The bar is clean: a fresh form
      assert.equal(await bar.getByRole('status').innerText(), '')
    }

    const pots = await Category.findByOrFail('slug', 'pots-another')
    const pans = await Category.findByOrFail('slug', 'pans-another')
    assert.equal(pots.name, 'Pots')
    // The last toast's View link opens the record it names
    await page
      .locator('.azu-toast', { hasText: 'Category created' })
      .last()
      .getByRole('link', { name: 'View' })
      .click()
    await page.waitForURL(`**${CATEGORIES}/${pans.id}`)
  })

  test('Save & keep editing: the edit form again, with the values as stored', async ({
    visit,
    browserContext,
    assert,
  }) => {
    await browserContext.loginAs(await createUser('admin'))
    const category = await Category.create({ name: 'Books', slug: 'books-keep-editing' })
    const gift = await Tag.create({ name: 'gift', slug: 'gift-keep-editing' })
    const product = await Product.create({
      categoryId: category.id,
      name: 'Lagos Noir',
      sku: 'KEEP-EDIT',
      price: '11250.00',
      stock: 3,
      status: 'draft',
      isFeatured: false,
      // Stored before the sanitiser: a save stores it cleaned
      description: '<p>Twelve stories.</p><script>alert(1)</script>',
    })
    await product.related('tags').attach([gift.id])

    const edit = `/admin/resources/products/${product.id}/edit`
    const page = await visit(edit)
    const bar = page.locator('.azu-save-bar')
    await page.locator('[data-azu-field="description"] [contenteditable="true"]').waitFor()
    assert.deepEqual(await bar.locator('.azu-save-actions > *').allInnerTexts(), [
      'Cancel',
      'Save & keep editing',
      'Save changes',
    ])
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      assert.deepEqual(await axeViolations(page), [], `edit form, ${colorScheme}`)
    }

    await page.locator('[data-azu-field="name"] input').fill('Lagos Noir, revised')
    assert.equal(await bar.getByRole('status').innerText(), 'Unsaved changes')
    await bar.getByRole('button', { name: 'Save & keep editing' }).click()
    await page.locator('.azu-toast', { hasText: 'Product saved' }).waitFor()
    await page.waitForFunction(
      () => (globalThis as any).document.querySelector('.azu-save-status')?.textContent === ''
    )

    assert.match(page.url(), new RegExp(`${edit}$`))
    await product.refresh()
    await product.load('tags')
    assert.equal(product.name, 'Lagos Noir, revised')
    assert.notInclude(product.description ?? '', '<script')
    assert.deepEqual(
      product.tags.map((tag) => tag.id),
      [gift.id]
    )
    // The form shows what was stored, and focus stays on the button
    assert.equal(
      await page.locator('[data-azu-field="name"] input').inputValue(),
      'Lagos Noir, revised'
    )
    await page
      .locator('[data-azu-field="tags"]')
      .getByRole('button', { name: 'Remove gift', exact: true })
      .waitFor()
    assert.equal(
      await page.locator('[data-azu-field="description"] [contenteditable="true"]').innerText(),
      'Twelve stories.'
    )
    assert.deepEqual(await focused(page), { field: null, after: 'edit' })

    // Saved: leaving doesn't ask
    await page.locator('.azu-sidebar').getByRole('link', { name: 'Tags' }).click()
    await page.waitForURL('**/admin/resources/tags')
    assert.equal(await page.getByRole('alertdialog').count(), 0)
  })

  test('an invalid submit keeps the input and errors, whichever button sent it', async ({
    visit,
    browserContext,
    assert,
  }) => {
    await browserContext.loginAs(await createUser('admin'))
    const category = await Category.create({ name: 'Kitchen', slug: 'kitchen-invalid-after' })
    const page = await visit(`${CATEGORIES}/create`)
    const name = page.locator('[data-azu-field="name"] input')

    await name.fill('K')
    await page.locator('[data-azu-field="slug"] input').fill('k-invalid-after')
    await page.getByRole('button', { name: 'Create & add another' }).click()
    await page.locator('[data-azu-field="name"] input[aria-invalid="true"]').waitFor()
    assert.match(page.url(), /\/categories\/create$/)
    assert.equal(await name.inputValue(), 'K')
    assert.isNull(await Category.findBy('slug', 'k-invalid-after'))

    await page.goto(`${CATEGORIES}/${category.id}/edit`)
    await name.fill('K')
    await page.getByRole('button', { name: 'Save & keep editing' }).click()
    await page.locator('[data-azu-field="name"] input[aria-invalid="true"]').waitFor()
    assert.equal(await name.inputValue(), 'K')
    assert.equal(
      await page.locator('.azu-save-bar').getByRole('status').innerText(),
      'Unsaved changes · 1 field needs attention'
    )
    await category.refresh()
    assert.equal(category.name, 'Kitchen')
  })

  test('on a phone the labels shorten, the buttons are 44px, and the bar stays on one line', async ({
    visit,
    browserContext,
    assert,
  }) => {
    await browserContext.loginAs(await createUser('admin'))
    const category = await Category.create({ name: 'Kitchen', slug: 'kitchen-phone-after' })
    const page = await visit(`${CATEGORIES}/create`)
    await page.setViewportSize({ width: 390, height: 844 })

    const check = async (labels: string[], form: string) => {
      const bar = page.locator('.azu-save-bar')
      await bar.waitFor()
      // Something to say in the status, so it has to share the line
      await page.locator('[data-azu-field="name"] input').fill('Pots and pans')
      assert.deepEqual(await bar.locator('.azu-save-actions > *').allInnerTexts(), labels, form)
      const layout = await bar.evaluate((element: any) => {
        const inner = element.querySelector('.azu-save-bar-inner')
        const middle = (child: any) => {
          const box = child.getBoundingClientRect()
          return Math.round(box.top + box.height / 2)
        }
        const buttons = [...inner.querySelectorAll('.azu-save-actions > *')]
        return {
          rows: new Set([...inner.children, ...buttons].map(middle)).size,
          heights: buttons.map((button: any) => Math.round(button.getBoundingClientRect().height)),
          overflows: inner.scrollWidth > inner.clientWidth,
        }
      })
      assert.equal(layout.rows, 1, form)
      assert.isTrue(
        layout.heights.every((height: number) => height >= 44),
        form
      )
      assert.isFalse(layout.overflows, form)
      for (const colorScheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme })
        assert.deepEqual(await axeViolations(page), [], `${form} on a phone, ${colorScheme}`)
      }
    }

    await check(['Cancel', 'Add another', 'Create'], 'create')
    await page.goto(`${CATEGORIES}/${category.id}/edit`)
    await check(['Cancel', 'Keep editing', 'Save changes'], 'edit')
  })

  test('without create or update, neither button shows', async ({
    visit,
    browserContext,
    assert,
  }) => {
    // Staff fail CouponPolicy's create and update
    await browserContext.loginAs(await createUser('staff'))
    const page = await visit('/admin/resources/coupons/create')
    await page.getByRole('heading', { level: 1 }).waitFor()
    assert.equal(await page.getByRole('button', { name: /add another|keep editing/i }).count(), 0)
    assert.equal(await page.locator('form').count(), 0)
  })
})
