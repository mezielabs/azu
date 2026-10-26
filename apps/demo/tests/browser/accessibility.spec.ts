import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import type { Page } from 'playwright'
import Category from '#models/category'
import Coupon from '#models/coupon'
import Product from '#models/product'
import Tag from '#models/tag'
import { createUser } from '../functional/admin/helpers.ts'
import { axeViolations } from './axe.ts'

type Fixtures = { category: Category; coupon: Coupon }

/**
 * A page to scan: where to go, what to open, and whether a React Aria
 * popover is open when it's scanned (see `axeViolations`).
 */
type Scan = {
  name: string
  url: (fixtures: Fixtures) => string
  open?: (page: Page) => Promise<void>
  popoverOpen?: boolean
}

const scans: Scan[] = [
  { name: 'dashboard', url: () => '/admin' },
  {
    name: 'list with filters on',
    url: ({ category }) =>
      `/admin/resources/products?status=published&category=${category.id}&low-stock=1`,
    open: async (page) => {
      // The active filter buttons are tinted
      await page.waitForSelector('[data-azu-filter-button="category"][data-azu-active]')
    },
  },
  {
    name: "list with a filter's popover open",
    url: () => '/admin/resources/products',
    open: async (page) => {
      await page.click('[data-azu-filter-button="status"]')
      await page.waitForSelector('.azu-filter-dialog select')
    },
    popoverOpen: true,
  },
  {
    name: "list with a belongsTo filter's options open",
    url: () => '/admin/resources/products',
    open: async (page) => {
      await page.click('[data-azu-filter-button="category"]')
      await page.click('[aria-label="Show Category options"]')
      await page.waitForSelector('.azu-popover [role="option"]')
    },
    popoverOpen: true,
  },
  {
    name: 'list with a row actions menu open',
    url: () => '/admin/resources/products',
    open: async (page) => {
      await page.click('[aria-label="Actions for Clay pot"]')
      await page.waitForSelector('.azu-popover [role="menuitem"]')
    },
    popoverOpen: true,
  },
  {
    // A modal dialog, not a popover: every rule runs
    name: 'action dialog with a validation error',
    url: () => '/admin/resources/products',
    open: async (page) => {
      await page.click('[aria-label="Actions for Clay pot"]')
      await page.click('[role="menuitem"]:has-text("Restock")')
      await page.getByRole('region', { name: 'Stock adjustment' }).getByLabel('Quantity').waitFor()
      await page.click('[role="alertdialog"] button[type="submit"]')
      await page.waitForSelector('[role="alertdialog"] .azu-field-error')
    },
  },
  {
    name: 'create form with validation errors',
    url: () => '/admin/resources/products/create',
    open: async (page) => {
      await page.click('form button[type="submit"]')
      await page.waitForSelector('.azu-field-error')
    },
  },
  {
    name: "form with a belongsTo field's options open",
    url: () => '/admin/resources/products/create',
    open: async (page) => {
      await page.click('[aria-label="Show Category options"]')
      await page.waitForSelector('.azu-popover [role="option"]')
    },
    popoverOpen: true,
  },
  {
    name: "form with a manyToMany picker's options open",
    url: () => '/admin/resources/products/create',
    open: async (page) => {
      const trigger = page.locator('[data-azu-field="tags"] [aria-label="Show Tags options"]')
      // Put the entire picker in view before opening its options. Focusing
      // an input at the viewport edge scrolls it, which closes the popover.
      await trigger.evaluate((element: any) => element.scrollIntoView({ block: 'center' }))
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            const frame = (globalThis as any).requestAnimationFrame
            frame(() => frame(() => resolve()))
          })
      )
      await trigger.click()
      await page.waitForSelector('.azu-popover [role="option"]')
    },
    popoverOpen: true,
  },
  {
    name: "edit form with a date picker's calendar open",
    url: ({ coupon }) => `/admin/resources/coupons/${coupon.id}/edit`,
    open: async (page) => {
      await page.click('[data-azu-field="startsOn"] [aria-label="Open calendar"]')
      await page.waitForSelector('.azu-popover [role="grid"]')
    },
    popoverOpen: true,
  },
  {
    name: 'detail page with a hasMany table',
    url: ({ category }) => `/admin/resources/categories/${category.id}`,
    open: async (page) => {
      await page.waitForSelector('[role="grid"]')
    },
  },
  {
    name: 'orders list with every badge colour',
    url: () => '/admin/resources/orders',
    open: async (page) => {
      await page.waitForSelector('.azu-badge')
    },
  },
]

async function fixtures(): Promise<Fixtures> {
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
  await Tag.createMany([
    { name: 'Clay', slug: 'clay-axe' },
    { name: 'Gift', slug: 'gift-axe' },
  ])
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

async function ordersInEveryStatus() {
  const { default: Order } = await import('#models/order')
  const customer = await createUser('customer')
  for (const status of ['pending', 'paid', 'shipped', 'cancelled'] as const) {
    await Order.create({
      userId: customer.id,
      number: `AXE-${status}`,
      status,
      total: '10.00',
      placedAt: DateTime.now(),
    })
  }
}

/**
 * Automated axe checks on the admin's core pages (spec §10), in both
 * themes (FR-14), with popovers, menus and dialogs open as well as
 * closed.
 */
for (const colorScheme of ['light', 'dark'] as const) {
  test.group(`Accessibility (axe), ${colorScheme} theme`, (group) => {
    group.each.setup(() => testUtils.db().withGlobalTransaction())

    for (const scan of scans) {
      test(scan.name, async ({ visit, browserContext, assert }) => {
        await browserContext.loginAs(await createUser('admin'))
        const data = await fixtures()
        await ordersInEveryStatus()
        const page = await visit(scan.url(data))
        await page.emulateMedia({ colorScheme })
        await page.waitForSelector('.azu-main')
        await scan.open?.(page)
        // The palette in effect is this theme's
        const scheme = await page.evaluate(
          () =>
            (globalThis as any).getComputedStyle((globalThis as any).document.documentElement)
              .colorScheme
        )
        assert.equal(scheme, colorScheme)
        assert.deepEqual(await axeViolations(page, { popoverOpen: scan.popoverOpen }), [])
      })
    }
  })
}
