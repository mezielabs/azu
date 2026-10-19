import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Category from '#models/category'
import Product from '#models/product'
import { createUser } from '../functional/admin/helpers.ts'
import { axeViolations } from './axe.ts'

async function product() {
  const category = await Category.create({ name: 'Books', slug: 'books-form-ui' })
  return Product.create({
    categoryId: category.id,
    name: 'Lagos Noir',
    sku: 'SKU-FORM',
    price: '11250.00',
    stock: 23,
    status: 'published',
    isFeatured: false,
    description: '<p>Twelve stories set between Yaba and the Island.</p>',
  })
}

/**
 * The create and edit form (layout 4/4): short fields in pairs, the
 * currency prefix, the sticky save bar and the rich text toolbar.
 */
test.group('Form page', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('short fields pair up on a wide form, and stack on a phone', async ({
    visit,
    browserContext,
    assert,
  }) => {
    await browserContext.loginAs(await createUser('admin'))
    const record = await product()
    const page = await visit(`/admin/resources/products/${record.id}/edit`)
    await page.setViewportSize({ width: 1280, height: 800 })

    const box = async (name: string) =>
      (await page.locator(`[data-azu-field="${name}"]`).first().boundingBox())!
    const name = await box('name')
    let sku = await box('sku')
    let price = await box('price')
    // SKU (40 characters) and price share a row; the name takes it all
    assert.equal(Math.round(sku.y), Math.round(price.y))
    assert.isAbove(price.x, sku.x + sku.width - 1)
    assert.approximately(name.width, sku.width + price.width, 24)
    // The form keeps to its reading width
    const form = (await page.locator('.azu-form-body').boundingBox())!
    assert.isAtMost(form.width, 760)
    // The price column's currency, beside the input
    assert.equal(await page.locator('[data-azu-field="price"] .azu-affix').innerText(), 'NGN')

    await page.setViewportSize({ width: 390, height: 844 })
    sku = await box('sku')
    price = await box('price')
    assert.isAtLeast(price.y, sku.y + sku.height)
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      assert.deepEqual(await axeViolations(page), [], `phone form, ${colorScheme}`)
    }
  })

  test('the save bar stays at the bottom of the window and says what needs doing', async ({
    visit,
    browserContext,
    assert,
  }) => {
    await browserContext.loginAs(await createUser('admin'))
    const record = await product()
    const page = await visit(`/admin/resources/products/${record.id}/edit`)
    await page.setViewportSize({ width: 1280, height: 600 })

    const bar = page.locator('.azu-save-bar')
    const status = bar.getByRole('status')
    const pinned = async () => {
      const bottom = await bar.evaluate((element: any) => element.getBoundingClientRect().bottom)
      const height = await page.evaluate(() => (globalThis as any).innerHeight)
      assert.equal(Math.round(bottom), height)
    }
    // Pinned while the form runs past the window, with Cancel and Save in it
    await pinned()
    await bar.getByRole('link', { name: 'Cancel' }).waitFor()
    await bar.getByRole('button', { name: 'Save changes' }).waitFor()
    assert.equal(await status.innerText(), '')

    await page.locator('[data-azu-field="name"] input').fill('Lagos Noir, second edition')
    assert.equal(await status.innerText(), 'Unsaved changes')

    // A bad price comes back from the validator: the bar counts it
    await page.locator('[data-azu-field="price"] input').fill('-5')
    await bar.getByRole('button', { name: 'Save changes' }).click()
    await page.locator('[data-azu-field="price"] input[aria-invalid="true"]').waitFor()
    assert.equal(await status.innerText(), 'Unsaved changes · 1 field needs attention')
    await pinned()
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      assert.deepEqual(await axeViolations(page), [], `invalid form, ${colorScheme}`)
    }

    // Fixing it clears the count
    await page.locator('[data-azu-field="price"] input').fill('12000.00')
    assert.equal(await status.innerText(), 'Unsaved changes')
    await bar.getByRole('button', { name: 'Save changes' }).click()
    await page.waitForURL(`**/admin/resources/products/${record.id}`)
    await record.refresh()
    assert.equal(record.name, 'Lagos Noir, second edition')
  })

  test('the rich text toolbar is named icon buttons', async ({ visit, browserContext, assert }) => {
    await browserContext.loginAs(await createUser('admin'))
    const record = await product()
    const page = await visit(`/admin/resources/products/${record.id}/edit`)

    const toolbar = page.getByRole('toolbar', { name: 'Formatting' })
    await toolbar.waitFor()
    const names = await toolbar
      .getByRole('button')
      .evaluateAll((buttons: any[]) => buttons.map((button) => button.getAttribute('aria-label')))
    assert.deepEqual(names, [
      'Bold',
      'Italic',
      'Heading',
      'Bulleted list',
      'Numbered list',
      'Quote',
    ])
    // Icons, not words: the visible text is at most a letter
    for (const text of await toolbar.getByRole('button').allInnerTexts()) {
      assert.isAtMost(text.trim().length, 1)
    }

    const bold = toolbar.getByRole('button', { name: 'Bold' })
    assert.equal(await bold.getAttribute('aria-pressed'), 'false')
    await page.locator('[data-azu-field="description"] [contenteditable="true"]').click()
    await page.keyboard.press('ControlOrMeta+a')
    await bold.click()
    assert.equal(await bold.getAttribute('aria-pressed'), 'true')
  })

  test('the editor takes its loaded height while it loads', async ({
    visit,
    browserContext,
    assert,
  }) => {
    await browserContext.loginAs(await createUser('admin'))
    // Hold the editor's chunk back, so the placeholder shows
    let release = () => {}
    const held = new Promise<void>((resolve) => (release = resolve))
    await browserContext.route(/rich_text_editor/, async (route) => {
      await held
      await route.continue()
    })
    const page = await visit('/admin/resources/products/create')
    const editor = page.locator('[data-azu-field="description"] .azu-rich-text')
    await page.locator('[data-azu-field="description"] [aria-busy="true"]').waitFor()
    const loading = (await editor.boundingBox())!.height

    release()
    await page.locator('[data-azu-field="description"] [contenteditable="true"]').waitFor()
    assert.equal(Math.round((await editor.boundingBox())!.height), Math.round(loading))
  })
})
