import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { createUser } from '../functional/admin/helpers.ts'
import { axeViolations } from './axe.ts'

/**
 * The admin shell: the sidebar's user, theme and sign out, and below
 * 768px the top bar's menu, a modal drawer.
 */
test.group('Shell', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('the sidebar shows the signed-in user, and signs them out', async ({
    visit,
    browserContext,
    assert,
  }) => {
    const admin = await createUser('admin')
    await browserContext.loginAs(admin)
    const page = await visit('/admin/resources/products')
    const sidebar = page.locator('.azu-sidebar')

    await sidebar.getByText(admin.fullName!).waitFor()
    await sidebar.getByText(admin.email).waitFor()
    assert.equal(await sidebar.getByRole('link', { name: 'View site' }).getAttribute('href'), '/')
    // Every page's header: breadcrumb, title, actions
    await page.getByRole('navigation', { name: 'Breadcrumb' }).getByText('Catalog').waitFor()
    await page.getByRole('heading', { level: 1, name: 'Products' }).waitFor()

    await sidebar.getByRole('button', { name: 'Sign out' }).click()
    await page.waitForURL('**/login')
    await page.goto('/admin')
    await page.waitForURL('**/login')
  })

  test('below 768px, the menu is a drawer: focus trapped, Escape closes, 44px targets', async ({
    visit,
    browserContext,
    assert,
  }) => {
    await browserContext.loginAs(await createUser('admin'))
    const page = await visit('/admin/resources/products')
    await page.setViewportSize({ width: 390, height: 844 })

    assert.isFalse(await page.locator('.azu-sidebar').isVisible())
    const open = page.getByRole('button', { name: 'Open menu' })
    await open.click()
    const menu = page.getByRole('dialog', { name: 'Menu' })
    await menu.waitFor()

    // 44px targets
    const sizes = await page
      .locator(
        '.azu-topbar .azu-icon-button, .azu-drawer .azu-nav-link, .azu-drawer .azu-sidebar-row, .azu-drawer .azu-icon-button'
      )
      .evaluateAll((elements) =>
        elements
          .filter((element: any) => element.offsetParent !== null)
          .map((element: any) => Math.round(element.getBoundingClientRect().height))
      )
    assert.isAbove(sizes.length, 6)
    assert.isTrue(
      sizes.every((height) => height >= 44),
      `heights: ${sizes.join(', ')}`
    )

    // Focus stays inside the drawer
    for (let index = 0; index < 20; index++) {
      await page.keyboard.press('Tab')
      assert.isTrue(
        await page.evaluate(() =>
          Boolean((globalThis as any).document.activeElement?.closest('.azu-drawer'))
        )
      )
    }

    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      assert.deepEqual(await axeViolations(page), [], `menu, ${colorScheme}`)
    }

    // Escape closes it, and focus goes back to the menu button
    await page.keyboard.press('Escape')
    await menu.waitFor({ state: 'detached' })
    assert.equal(
      await page.evaluate(() =>
        (globalThis as any).document.activeElement?.getAttribute('aria-label')
      ),
      'Open menu'
    )

    // A link in the menu visits the page and closes it
    await open.click()
    await menu.getByRole('link', { name: 'Categories' }).click()
    await page.waitForURL('**/admin/resources/categories')
    await menu.waitFor({ state: 'detached' })
  })

  test('on a page taller than the window, the sidebar stays put, full height', async ({
    visit,
    browserContext,
    assert,
  }) => {
    await browserContext.loginAs(await createUser('admin'))
    const { insertProducts } = await import('../functional/admin/helpers.ts')
    const { default: Category } = await import('#models/category')
    await insertProducts(await Category.create({ name: 'Tall', slug: 'tall-shell' }), 100)
    const page = await visit('/admin/resources/products?perPage=100')
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.locator('.azu-list-table').waitFor()

    const measure = () =>
      page.evaluate(() => {
        const browser = globalThis as any
        const sidebar = browser.document.querySelector('.azu-sidebar')
        const box = sidebar.getBoundingClientRect()
        const style = browser.getComputedStyle(sidebar)
        // What's painted at the sidebar's bottom-left corner of the window
        const corner = browser.document.elementFromPoint(8, browser.innerHeight - 4)
        return {
          scrolled: browser.scrollY,
          pageHeight: browser.document.documentElement.scrollHeight,
          windowHeight: browser.innerHeight,
          top: Math.round(box.top),
          bottom: Math.round(box.bottom),
          border: style.borderRightWidth,
          background: style.backgroundColor,
          cornerInSidebar: Boolean(corner?.closest('.azu-sidebar')),
        }
      })

    const before = await measure()
    assert.isAbove(before.pageHeight, before.windowHeight * 2)
    await page.evaluate(() =>
      (globalThis as any).scrollTo(0, (globalThis as any).document.documentElement.scrollHeight)
    )
    const after = await measure()

    assert.isAbove(after.scrolled, 0)
    for (const state of [before, after]) {
      // Pinned to the window, top to bottom, with its border and background
      assert.equal(state.top, 0)
      assert.equal(state.bottom, state.windowHeight)
      assert.equal(state.border, '1px')
      assert.notEqual(state.background, 'rgba(0, 0, 0, 0)')
      assert.isTrue(state.cornerInSidebar)
    }
  })
})
