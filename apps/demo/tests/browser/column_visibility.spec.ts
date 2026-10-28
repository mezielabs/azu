import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Category from '#models/category'
import { createUser, insertProducts } from '../functional/admin/helpers.ts'
import { axeViolations } from './axe.ts'

/** The `?columns=` names in the page's URL, or null without one */
function chosen(url: string) {
  return new URL(url).searchParams.get('columns')
}

test.group('List column visibility (U09)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('the choice is in the URL, through list updates, guards the last column and resets', async ({
    visit,
    browserContext,
    assert,
  }) => {
    await browserContext.loginAs(await createUser('admin'))
    const category = await Category.create({ name: 'Kitchen', slug: 'columns-desktop' })
    await insertProducts(category, 11, 'Clay pot')
    const page = await visit('/admin/resources/products?perPage=10')
    // In the list's control row, after the filters; the header keeps page actions only
    const trigger = page
      .locator('.azu-list-controls')
      .getByRole('button', { name: 'Columns', exact: true })
    assert.equal(
      await page.locator('.azu-page-header').getByRole('button', { name: 'Columns' }).count(),
      0
    )
    assert.isTrue(
      await trigger.evaluate((element: any) =>
        Boolean(
          element
            .closest('.azu-list-controls')
            // After the filters (DOCUMENT_POSITION_FOLLOWING)
            .querySelector('.azu-filters')
            ?.compareDocumentPosition(element) & 4
        )
      )
    )
    const dialog = page.getByRole('dialog', { name: 'Visible columns' })
    const header = (name: string) => page.getByRole('columnheader', { name, exact: true })
    assert.equal(await header('SKU').count(), 0)
    assert.isNull(chosen(page.url()))

    await trigger.click()
    const sku = dialog.getByRole('checkbox', { name: 'SKU', exact: true })
    await sku.check()
    await dialog.getByRole('checkbox', { name: 'Price', exact: true }).uncheck()
    await page.keyboard.press('Escape')
    assert.isTrue(await trigger.evaluate((e: any) => e === e.ownerDocument.activeElement))
    await header('SKU').waitFor()
    await page.waitForURL((url) => chosen(url.href)?.includes('sku') === true)
    const columns = chosen(page.url())!
    assert.notInclude(columns.split(','), 'price')
    assert.equal(await header('Price').count(), 0)
    // Commas as written: ?columns=thumbnail,name,…
    assert.include(page.url(), `columns=${columns}`)

    // Paging, sorting, filtering and searching keep it
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await page.waitForURL(/page=2/)
    assert.equal(chosen(page.url()), columns)
    await header('SKU').waitFor()
    await header('Name').click()
    await page.waitForURL(/sort=name/)
    assert.equal(chosen(page.url()), columns)
    const search = page.getByRole('searchbox', { name: 'Search products' })
    await search.fill('Clay')
    await search.press('Enter')
    await page.waitForURL(/search=Clay/)
    assert.equal(chosen(page.url()), columns)
    await header('SKU').waitFor()

    // The last column can't be hidden
    await trigger.click()
    for (const option of await dialog.getByRole('checkbox').all()) {
      if (
        (await option.isChecked()) &&
        (await option.evaluate((e: any) => e.parentElement.textContent.trim())) !== 'SKU'
      )
        await option.uncheck()
    }
    assert.isTrue(await sku.isDisabled())
    await page.waitForURL((url) => chosen(url.href) === 'sku')

    // Reset removes the parameter
    await dialog.getByRole('button', { name: 'Reset to defaults' }).click()
    assert.isFalse(await sku.isChecked())
    await page.keyboard.press('Escape')
    await header('Price').waitFor()
    await page.waitForURL((url) => chosen(url.href) === null)
    assert.include(page.url(), 'search=Clay')
  })

  test('the choice survives opening a record and coming back, a reload and a shared link', async ({
    visit,
    browserContext,
    assert,
  }) => {
    await browserContext.loginAs(await createUser('admin'))
    const category = await Category.create({ name: 'Kitchen', slug: 'columns-return' })
    await insertProducts(category, 3, 'Clay pot')
    const page = await visit('/admin/resources/products')
    const header = (name: string) => page.getByRole('columnheader', { name, exact: true })
    await page.getByRole('button', { name: 'Columns', exact: true }).click()
    await page
      .getByRole('dialog', { name: 'Visible columns' })
      .getByRole('checkbox', { name: 'SKU', exact: true })
      .check()
    await page.keyboard.press('Escape')
    await page.waitForURL((url) => chosen(url.href)?.includes('sku') === true)
    const shared = page.url()

    // List → record → back
    await page.getByRole('link', { name: 'Clay pot' }).first().click()
    await page.waitForURL(/\/products\/\d+$/)
    await page.goBack()
    await page.waitForURL((url) => chosen(url.href)?.includes('sku') === true)
    await header('SKU').waitFor()

    // A reload
    await page.reload()
    await header('SKU').waitFor()
    assert.equal(page.url(), shared)

    // A shared link, in a fresh page; a forged name is ignored
    const other = await visit(`${shared},forged`)
    await other.getByRole('columnheader', { name: 'SKU', exact: true }).waitFor()
    assert.equal(await other.getByRole('columnheader', { name: 'Forged' }).count(), 0)
  })

  test('phone cards: two details by default, every chosen one with ?columns=', async ({
    visit,
    browserContext,
    assert,
  }) => {
    await browserContext.loginAs(await createUser('admin'))
    const category = await Category.create({ name: 'Kitchen', slug: 'columns-phone' })
    await insertProducts(category, 1, 'Clay pot')
    const page = await visit('/admin/resources/products')
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 })
      // The default card keeps #54's two-detail layout
      if (width === 320) {
        await page.locator('.azu-card-details').waitFor()
        assert.equal(await page.locator('.azu-card-details > span').count(), 2)
        assert.notInclude(await page.locator('.azu-card-details').innerText(), 'SKU:')
      }
      // Beside Sort by, and not in the header
      const trigger = page
        .locator('.azu-mobile-list-controls')
        .getByRole('button', { name: 'Columns', exact: true })
      assert.equal(await page.getByRole('button', { name: 'Columns', exact: true }).count(), 1)
      await trigger.click()
      const dialog = page.getByRole('dialog', { name: 'Visible columns' })
      await dialog.getByRole('checkbox', { name: 'SKU', exact: true }).check()
      assert.deepEqual(await axeViolations(page, { popoverOpen: true }), [])
      await page.keyboard.press('Escape')
      await page.waitForURL((url) => chosen(url.href)?.includes('sku') === true)
      const details = page.locator('.azu-card-details')
      await details.getByText('SKU:').waitFor()
      assert.equal(await details.locator(':scope > span').count(), 4)
      const detailBox = (await details.boundingBox())!
      const badgeBox = (await page.locator('.azu-card-badge').boundingBox())!
      assert.isAtLeast(badgeBox.y, detailBox.y + detailBox.height)
      const overflow = await page.evaluate(() => {
        const d = (globalThis as any).document.documentElement
        return d.scrollWidth > d.clientWidth
      })
      assert.isFalse(overflow)
      for (const colorScheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme })
        assert.deepEqual(await axeViolations(page), [])
      }
    }
  })
})
