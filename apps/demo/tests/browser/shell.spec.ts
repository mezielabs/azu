import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { createUser } from '../functional/admin/helpers.ts'
import { axeViolations } from './axe.ts'

/**
 * The admin shell: the sidebar's account menu (theme, View site, Sign
 * out), and below 768px the top bar's menu, a modal drawer.
 */
test.group('Shell', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('the account menu shows the user, links to the site, and signs out', async ({
    visit,
    browserContext,
    assert,
  }) => {
    const admin = await createUser('admin')
    await browserContext.loginAs(admin)
    const page = await visit('/admin/resources/products')
    const account = page
      .locator('.azu-sidebar')
      .getByRole('button', { name: `Account: ${admin.fullName}` })

    // The whole row is the button: initials, name and email, the email
    // as its description
    assert.include(await account.innerText(), admin.email)
    const described = await account.getAttribute('aria-describedby')
    assert.equal(await page.locator(`[id="${described}"]`).innerText(), admin.email)
    assert.equal(await account.getAttribute('aria-expanded'), 'false')
    // Every page's header: breadcrumb, title, actions
    await page.getByRole('navigation', { name: 'Breadcrumb' }).getByText('Catalog').waitFor()
    await page.getByRole('heading', { level: 1, name: 'Products' }).waitFor()

    await account.click()
    assert.equal(await account.getAttribute('aria-expanded'), 'true')
    const menu = page.getByRole('menu', { name: 'Account' })
    // It opens upward, above the button
    const menuBox = (await menu.boundingBox())!
    assert.isAtMost(menuBox.y + menuBox.height, (await account.boundingBox())!.y)
    await page.locator('.azu-account-header').getByText(admin.email).waitFor()
    assert.equal(await menu.getByRole('menuitem', { name: 'View site' }).getAttribute('href'), '/')

    await menu.getByRole('menuitem', { name: 'Sign out' }).click()
    await page.waitForURL('**/login')
    await page.goto('/admin')
    await page.waitForURL('**/login')
  })

  test('a long name and email truncate in the 248px sidebar', async ({
    visit,
    browserContext,
    assert,
  }) => {
    const admin = await createUser('admin')
    admin.fullName = 'Chimamanda Ngozi Adichie-Oluwaseun Abernathy'
    admin.email = `a-very-long-address-for-testing-${admin.id}@a-long-company-domain.example`
    await admin.save()
    await browserContext.loginAs(admin)
    const page = await visit('/admin')
    const account = page.locator('.azu-sidebar .azu-account')
    await account.waitFor()

    const layout = await page.locator('.azu-sidebar').evaluate((sidebar: any) => {
      const button = sidebar.querySelector('.azu-account')
      const name = sidebar.querySelector('.azu-account .azu-user-name')
      const email = sidebar.querySelector('.azu-account .azu-user-email')
      const style = (element: any) => (globalThis as any).getComputedStyle(element)
      return {
        sidebar: Math.round(sidebar.getBoundingClientRect().width),
        buttonRight: button.getBoundingClientRect().right,
        sidebarRight: sidebar.getBoundingClientRect().right,
        overflows: sidebar.scrollWidth > sidebar.clientWidth,
        nameCut: name.scrollWidth > name.clientWidth,
        emailCut: email.scrollWidth > email.clientWidth,
        ellipses: [style(name).textOverflow, style(email).textOverflow],
      }
    })
    assert.equal(layout.sidebar, 248)
    assert.isFalse(layout.overflows)
    assert.isAtMost(layout.buttonRight, layout.sidebarRight)
    assert.isTrue(layout.nameCut)
    assert.isTrue(layout.emailCut)
    assert.deepEqual(layout.ellipses, ['ellipsis', 'ellipsis'])
    // The button's name is the whole name, cut short or not
    assert.equal(
      await page.getByRole('button', { name: `Account: ${admin.fullName}`, exact: true }).count(),
      1
    )
  })

  test('the account menu works from the keyboard, and passes axe open', async ({
    visit,
    browserContext,
    assert,
  }) => {
    const admin = await createUser('admin')
    await browserContext.loginAs(admin)
    const page = await visit('/admin')
    const account = page.getByRole('button', { name: `Account: ${admin.fullName}` })
    await account.focus()
    await page.keyboard.press('Enter')
    const menu = page.getByRole('menu', { name: 'Account' })
    await menu.waitFor()
    const focused = () =>
      page.evaluate(() => (globalThis as any).document.activeElement?.textContent?.trim())

    // Focus starts on the first item; the arrows move through them
    assert.equal(await focused(), 'Light')
    await page.keyboard.press('ArrowDown')
    assert.equal(await focused(), 'Dark')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    assert.equal(await focused(), 'View site')

    // The theme items are one single-selection group; System is the default
    const themes = menu.getByRole('menuitemradio')
    assert.deepEqual(await themes.allInnerTexts(), ['Light', 'Dark', 'System'])
    assert.equal(
      await menu.getByRole('menuitemradio', { name: 'System' }).getAttribute('aria-checked'),
      'true'
    )
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      assert.deepEqual(
        await axeViolations(page, { popoverOpen: true }),
        [],
        `account menu, ${colorScheme}`
      )
    }

    // Escape closes it and returns focus to the button
    await page.keyboard.press('Escape')
    await menu.waitFor({ state: 'detached' })
    assert.equal(
      await page.evaluate(() =>
        (globalThis as any).document.activeElement?.classList.contains('azu-account')
      ),
      true
    )
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

    // The theme row is the three choices
    const theme = menu.getByRole('radiogroup', { name: 'Theme' })
    assert.deepEqual(
      await theme
        .getByRole('radio')
        .evaluateAll((radios: any[]) =>
          radios.map((radio) => radio.closest('label').textContent.trim())
        ),
      ['Light', 'Dark', 'System']
    )
    assert.isTrue(await theme.getByRole('radio', { name: 'System' }).isChecked())

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
