import { test } from '@japa/runner'
import type { TestContext } from '@japa/runner/core'
import testUtils from '@adonisjs/core/services/test_utils'
import Category from '#models/category'
import { createUser } from '../functional/admin/helpers.ts'
import { axeViolations } from './axe.ts'

/**
 * The unsaved-changes guard on the create and edit forms (FR-06): a
 * "Leave without saving?" dialog for Inertia visits away, the browser's
 * prompt for reloads and closing the tab, and nothing after a save or
 * when nothing changed.
 */
test.group('Unsaved changes', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  async function editCategory({
    visit,
    browserContext,
  }: Pick<TestContext, 'visit' | 'browserContext'>) {
    await browserContext.loginAs(await createUser('admin'))
    const category = await Category.create({ name: 'Kitchen', slug: 'kitchen-unsaved' })
    const page = await visit(`/admin/resources/categories/${category.id}/edit`)
    const name = page.locator('[data-azu-field="name"] input')
    await name.waitFor()
    return { page, category, name }
  }

  test('a nav link asks first: Stay keeps the edit, Leave goes', async ({
    visit,
    browserContext,
    assert,
  }) => {
    const { page, category, name } = await editCategory({ visit, browserContext })
    await name.fill('Kitchen and dining')

    const sidebar = page.locator('.azu-sidebar')
    await sidebar.getByRole('link', { name: 'Tags' }).click()
    const dialog = page.getByRole('alertdialog', { name: 'Leave without saving?' })
    await dialog.waitFor()
    // Stay has focus, so Enter keeps the edit
    assert.equal(
      await page.evaluate(() => (globalThis as any).document.activeElement?.textContent),
      'Stay'
    )
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      assert.deepEqual(await axeViolations(page), [], `dialog, ${colorScheme}`)
    }

    await dialog.getByRole('button', { name: 'Stay' }).click()
    await dialog.waitFor({ state: 'detached' })
    assert.match(page.url(), new RegExp(`/categories/${category.id}/edit$`))
    assert.equal(await name.inputValue(), 'Kitchen and dining')

    // The breadcrumb asks too; Leave follows it, unsaved
    await page
      .getByRole('navigation', { name: 'Breadcrumb' })
      .getByRole('link', { name: 'Categories' })
      .click()
    await dialog.getByRole('button', { name: 'Leave' }).click()
    await page.waitForURL('**/admin/resources/categories')
    await category.refresh()
    assert.equal(category.name, 'Kitchen')
  })

  test('Cancel asks, and so does Sign out, which still signs out on Leave', async ({
    visit,
    browserContext,
  }) => {
    const { page, category, name } = await editCategory({ visit, browserContext })
    await name.fill('Kitchen and dining')

    await page.getByRole('link', { name: 'Cancel' }).click()
    const dialog = page.getByRole('alertdialog', { name: 'Leave without saving?' })
    await dialog.getByRole('button', { name: 'Leave' }).click()
    await page.waitForURL(`**/admin/resources/categories/${category.id}`)

    // Sign out is a POST: asked too, and replayed as one
    await page.goto(`/admin/resources/categories/${category.id}/edit`)
    await name.fill('Kitchen and dining')
    await page.locator('.azu-sidebar').getByRole('button', { name: 'Sign out' }).click()
    await dialog.getByRole('button', { name: 'Leave' }).click()
    await page.waitForURL('**/login')
  })

  test('saving never asks, and nothing changed means no question', async ({
    visit,
    browserContext,
    assert,
  }) => {
    const { page, category, name } = await editCategory({ visit, browserContext })
    const dialog = page.getByRole('alertdialog', { name: 'Leave without saving?' })

    // Unchanged: the link just goes
    await page.locator('.azu-sidebar').getByRole('link', { name: 'Tags' }).click()
    await page.waitForURL('**/admin/resources/tags')
    assert.equal(await dialog.count(), 0)

    // Changed, then saved: the submit and its redirect pass, and so does what follows
    await page.goto(`/admin/resources/categories/${category.id}/edit`)
    await name.fill('Kitchen and dining')
    await page.locator('form button[type="submit"]').click()
    await page.waitForURL(`**/admin/resources/categories/${category.id}`)
    await page.locator('.azu-sidebar').getByRole('link', { name: 'Tags' }).click()
    await page.waitForURL('**/admin/resources/tags')
    assert.equal(await dialog.count(), 0)
    await category.refresh()
    assert.equal(category.name, 'Kitchen and dining')

    // An invalid submit keeps the changes, and the guard
    await page.goto(`/admin/resources/categories/${category.id}/edit`)
    await name.fill('K')
    await page.locator('form button[type="submit"]').click()
    await page.locator('[data-azu-field="name"] input[aria-invalid="true"]').waitFor()
    await page.locator('.azu-sidebar').getByRole('link', { name: 'Tags' }).click()
    await dialog.waitFor()
  })

  test("closing the tab with changes gets the browser's own prompt", async ({
    visit,
    browserContext,
    assert,
  }) => {
    const { page, name } = await editCategory({ visit, browserContext })
    await name.fill('Kitchen and dining')

    const prompt = page.waitForEvent('dialog')
    await page.close({ runBeforeUnload: true })
    const dialog = await prompt
    assert.equal(dialog.type(), 'beforeunload')
    await dialog.dismiss()
  })
})
