import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import Setting from '#models/setting'
import { createUser } from '../functional/admin/helpers.ts'
import { axeViolations } from './axe.ts'
import { toastAgainstSaveBar } from './overlap.ts'

const SETTINGS = '/admin/screens/store-settings'

async function seedSettings() {
  await Setting.store({
    storeName: 'Azu Store',
    supportEmail: 'help@azu.test',
    currency: 'NGN',
    vatRate: '7.50',
    maintenanceMode: false,
    checkoutAnnouncement: '<p>Free delivery in Lagos</p>',
    lastChangedAt: DateTime.utc(2026, 10, 1, 9, 0),
  })
}

/**
 * A form screen in the browser (FR-23): the demo's Store settings.
 */
test.group('Screen forms', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('an admin edits the settings: a toast, the stored values, and a clean form', async ({
    visit,
    browserContext,
    assert,
  }) => {
    await seedSettings()
    await browserContext.loginAs(await createUser('admin'))
    const page = await visit('/admin')

    const sidebar = page.locator('.azu-sidebar')
    await sidebar.getByRole('link', { name: 'Store settings' }).click()
    await page.waitForURL(`**${SETTINGS}`)
    await page.getByRole('heading', { level: 1, name: 'Store settings' }).waitFor()
    await page
      .getByRole('navigation', { name: 'Breadcrumb' })
      .getByText('Settings', { exact: true })
      .waitFor()

    // One button, no Cancel; the form loads on first use
    const bar = page.locator('.azu-save-bar')
    await bar.waitFor()
    const buttons = await bar.getByRole('button').allInnerTexts()
    assert.deepEqual(
      buttons.map((text) => text.trim()),
      ['Save changes']
    )
    assert.equal(await bar.getByRole('link', { name: 'Cancel' }).count(), 0)

    const storeName = page.getByRole('textbox', { name: /Store name/ })
    assert.equal(await storeName.inputValue(), 'Azu Store')
    await storeName.fill('Iya Basira Stores')
    await page.getByRole('textbox', { name: /VAT rate/ }).fill('12.5')
    // The switch's input is visually hidden; its label takes the click
    const maintenance = page.getByRole('switch', { name: /Maintenance mode/ })
    await page
      .locator('[data-azu-field="maintenanceMode"]')
      .getByText('Maintenance mode', { exact: true })
      .click()
    assert.isTrue(await maintenance.isChecked())
    await page.locator('.azu-save-status', { hasText: 'Unsaved changes' }).waitFor()

    await bar.getByRole('button', { name: 'Save changes' }).click()
    await page.locator('.azu-toast', { hasText: 'Store settings saved' }).waitFor()
    assert.match(page.url(), new RegExp(`${SETTINGS}$`))

    // The form shows the stored values again, with nothing unsaved
    assert.equal(await storeName.inputValue(), 'Iya Basira Stores')
    // Typed as 12.5, stored and shown with two places
    assert.equal(await page.getByRole('textbox', { name: /VAT rate/ }).inputValue(), '12.50')
    assert.equal(await page.locator('.azu-save-status').getAttribute('data-azu-state'), 'clean')
    const stored = await Setting.values(['storeName', 'vatRate', 'maintenanceMode'])
    assert.deepEqual(stored, {
      storeName: 'Iya Basira Stores',
      vatRate: '12.50',
      maintenanceMode: true,
    })
  })

  test('an invalid save keeps the input and shows the errors under the fields', async ({
    visit,
    browserContext,
    assert,
  }) => {
    await seedSettings()
    await browserContext.loginAs(await createUser('admin'))
    const page = await visit(SETTINGS)
    await page.getByRole('textbox', { name: /Support email/ }).fill('not-an-email')
    await page.getByRole('textbox', { name: /VAT rate/ }).fill('120')
    await page.locator('.azu-save-bar').getByRole('button', { name: 'Save changes' }).click()

    await page.getByText('Support email must be an email address').waitFor()
    await page.getByText('VAT rate must be 100 or less').waitFor()
    assert.equal(
      await page.getByRole('textbox', { name: /Support email/ }).inputValue(),
      'not-an-email'
    )
    const { supportEmail } = await Setting.values(['supportEmail'])
    assert.equal(supportEmail, 'help@azu.test')
  })

  test('leaving with unsaved changes asks first', async ({ visit, browserContext, assert }) => {
    await seedSettings()
    await browserContext.loginAs(await createUser('admin'))
    const page = await visit(SETTINGS)
    await page.getByRole('textbox', { name: /Store name/ }).fill('Something else')

    await page.locator('.azu-sidebar').getByRole('link', { name: 'Products' }).click()
    const dialog = page.getByRole('alertdialog', { name: 'Leave without saving?' })
    await dialog.waitFor()
    await dialog.getByRole('button', { name: 'Stay' }).click()
    await dialog.waitFor({ state: 'detached' })
    assert.match(page.url(), new RegExp(`${SETTINGS}$`))

    await page.locator('.azu-sidebar').getByRole('link', { name: 'Products' }).click()
    await dialog.getByRole('button', { name: 'Leave' }).click()
    await page.waitForURL('**/admin/resources/products')
    const { storeName } = await Setting.values(['storeName'])
    assert.equal(storeName, 'Azu Store')
  })

  test('on a phone the toast sits above the save bar, clear of Save changes', async ({
    visit,
    browserContext,
    assert,
  }) => {
    await seedSettings()
    await browserContext.loginAs(await createUser('admin'))
    const page = await visit(SETTINGS)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.locator('.azu-save-bar').waitFor()
    await page.getByRole('textbox', { name: /Store name/ }).fill('Azu Store Abuja')
    await page.locator('.azu-save-bar').getByRole('button', { name: 'Save changes' }).click()
    assert.deepEqual(await toastAgainstSaveBar(page, 'Store settings saved'), {
      covered: [],
      overBar: false,
    })
  })

  test('staff see no Settings group', async ({ visit, browserContext, assert }) => {
    await browserContext.loginAs(await createUser('staff'))
    const page = await visit('/admin')
    const sidebar = page.locator('.azu-sidebar')
    await sidebar.getByRole('link', { name: 'Overview' }).waitFor()
    assert.notInclude(await sidebar.locator('.azu-nav-heading').allInnerTexts(), 'SETTINGS')
    assert.equal(await sidebar.getByRole('link', { name: 'Store settings' }).count(), 0)
  })

  test('the form passes axe in both themes, desktop and phone, clean and with errors', async ({
    visit,
    browserContext,
    assert,
  }) => {
    await seedSettings()
    await browserContext.loginAs(await createUser('admin'))
    const page = await visit(SETTINGS)
    for (const [width, height] of [
      [1440, 900],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height })
      await page.goto(SETTINGS)
      await page.locator('.azu-form').waitFor()
      for (const colorScheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme })
        assert.deepEqual(await axeViolations(page), [], `clean at ${width}px, ${colorScheme}`)
      }
      await page.getByRole('textbox', { name: /Store name/ }).fill('A')
      await page.locator('.azu-save-bar').getByRole('button', { name: 'Save changes' }).click()
      await page.getByText('Store name must be at least 2 characters').waitFor()
      for (const colorScheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme })
        assert.deepEqual(await axeViolations(page), [], `errors at ${width}px, ${colorScheme}`)
      }
    }
  })
})
