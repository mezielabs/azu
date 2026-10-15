import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import Category from '#models/category'
import Coupon from '#models/coupon'
import Product from '#models/product'
import { createUser } from '../functional/admin/helpers.ts'
import { axeViolations } from './axe.ts'

/**
 * Automated axe checks on the admin's core pages (spec §10), with
 * popovers, menus and dialogs open as well as closed.
 */
test.group('Accessibility (axe)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  async function signIn(browserContext: { loginAs(user: unknown): Promise<void> }) {
    await browserContext.loginAs(await createUser('admin'))
    const category = await Category.create({ name: 'Kitchen', slug: 'kitchen-axe' })
    await Product.create({
      categoryId: category.id,
      name: 'Clay pot',
      sku: 'AXE-1',
      price: '12.50',
      stock: 3,
      status: 'published',
      isFeatured: false,
    })
    const coupon = await Coupon.create({
      code: 'AXE10',
      kind: 'percent',
      amount: '10.00',
      currency: 'NGN',
      isActive: true,
      startsOn: DateTime.fromISO('2026-10-01'),
      categoryId: category.id,
    })
    return { category, coupon }
  }

  test('dashboard', async ({ visit, browserContext, assert }) => {
    await signIn(browserContext)
    const page = await visit('/admin')
    await page.waitForSelector('[data-azu-page="dashboard"], h1')
    assert.deepEqual(await axeViolations(page), [])
  })

  test('list with filters on', async ({ visit, browserContext, assert }) => {
    const { category } = await signIn(browserContext)
    const page = await visit(
      `/admin/resources/products?status=published&category=${category.id}&low-stock=1`
    )
    await page.waitForSelector('[data-azu-filter="category"] [role="combobox"]')
    assert.deepEqual(await axeViolations(page), [])
  })

  test("list with a belongsTo filter's options open", async ({ visit, browserContext, assert }) => {
    await signIn(browserContext)
    const page = await visit('/admin/resources/products')
    await page.click('[aria-label="Show Category options"]')
    await page.waitForSelector('.azu-popover [role="option"]')
    assert.deepEqual(await axeViolations(page, { popoverOpen: true }), [])
  })

  test('list with a row actions menu open', async ({ visit, browserContext, assert }) => {
    await signIn(browserContext)
    const page = await visit('/admin/resources/products')
    await page.click('[aria-label="Actions for Clay pot"]')
    await page.waitForSelector('.azu-popover [role="menuitem"]')
    assert.deepEqual(await axeViolations(page, { popoverOpen: true }), [])
  })

  test('action dialog with a validation error', async ({ visit, browserContext, assert }) => {
    await signIn(browserContext)
    const page = await visit('/admin/resources/products')
    await page.click('[aria-label="Actions for Clay pot"]')
    await page.click('[role="menuitem"]:has-text("Restock")')
    await page.waitForSelector('[role="alertdialog"] input')
    await page.click('[role="alertdialog"] button[type="submit"]')
    await page.waitForSelector('[role="alertdialog"] .azu-field-error')
    // A modal dialog, not a popover: every rule runs
    assert.deepEqual(await axeViolations(page), [])
  })

  test('create form with validation errors', async ({ visit, browserContext, assert }) => {
    await signIn(browserContext)
    const page = await visit('/admin/resources/products/create')
    await page.waitForSelector('form button[type="submit"]')
    await page.click('form button[type="submit"]')
    await page.waitForSelector('.azu-field-error')
    assert.deepEqual(await axeViolations(page), [])
  })

  test("form with a belongsTo field's options open", async ({ visit, browserContext, assert }) => {
    await signIn(browserContext)
    const page = await visit('/admin/resources/products/create')
    await page.click('[aria-label="Show Category options"]')
    await page.waitForSelector('.azu-popover [role="option"]')
    assert.deepEqual(await axeViolations(page, { popoverOpen: true }), [])
  })

  test("edit form with a date picker's calendar open", async ({
    visit,
    browserContext,
    assert,
  }) => {
    const { coupon } = await signIn(browserContext)
    const page = await visit(`/admin/resources/coupons/${coupon.id}/edit`)
    await page.click('[data-azu-field="startsOn"] [aria-label="Open calendar"]')
    await page.waitForSelector('.azu-popover [role="grid"]')
    assert.deepEqual(await axeViolations(page, { popoverOpen: true }), [])
  })

  test('detail page with a hasMany table', async ({ visit, browserContext, assert }) => {
    const { category } = await signIn(browserContext)
    const page = await visit(`/admin/resources/categories/${category.id}`)
    await page.waitForSelector('[role="grid"]')
    assert.deepEqual(await axeViolations(page), [])
  })
})
