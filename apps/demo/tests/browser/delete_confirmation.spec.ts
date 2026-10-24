import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Category from '#models/category'
import Product from '#models/product'
import productResource from '#admin/resources/product_resource'
import { createUser, insertProducts } from '../functional/admin/helpers.ts'
import { axeViolations } from './axe.ts'

test.group('Delete confirmation context', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('list and detail deletion name the record and focus Cancel', async ({
    visit,
    browserContext,
    assert,
  }) => {
    await browserContext.loginAs(await createUser('admin'))
    const category = await Category.create({ name: 'Kitchen', slug: 'delete-context' })
    await insertProducts(category, 1, 'Clay pot <large>')
    const product = await Product.firstOrFail()
    const page = await visit('/admin/resources/products')
    await page.getByRole('button', { name: 'Actions for Clay pot <large>', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Delete', exact: true }).click()
    const dialog = page.getByRole('alertdialog')
    await dialog.getByText('Delete “Clay pot <large>”?', { exact: true }).waitFor()
    assert.include(await dialog.innerText(), 'cannot be undone')
    assert.isTrue(
      await dialog
        .getByRole('button', { name: 'Cancel', exact: true })
        .evaluate((element: any) => element === (globalThis as any).document.activeElement)
    )
    assert.deepEqual(await axeViolations(page), [])
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    assert.isNotNull(await Product.find(product.id))
    await page.goto(`/admin/resources/products/${product.id}`)
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await dialog.getByText('Delete “Clay pot <large>”?', { exact: true }).waitFor()
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click()
    await page.waitForURL('**/admin/resources/products')
    assert.isNull(await Product.find(product.id))
  })

  test('bulk deletion distinguishes selected records from all matching records', async ({
    visit,
    browserContext,
    assert,
  }) => {
    await browserContext.loginAs(await createUser('admin'))
    const category = await Category.create({ name: 'Kitchen', slug: 'delete-bulk-context' })
    await insertProducts(category, 11)
    const page = await visit('/admin/resources/products?perPage=10')
    await page
      .locator('.azu-checkbox', {
        has: page.getByRole('checkbox', { name: 'Select All', exact: true }),
      })
      .click()
    const toolbar = page.getByRole('toolbar', { name: 'Bulk actions' })
    const openDelete = async () => {
      const button = toolbar.getByRole('button', { name: 'Delete', exact: true })
      if (await button.count()) await button.click()
      else {
        await toolbar.getByRole('button', { name: /More|Actions/ }).click()
        await page.getByRole('menuitem', { name: 'Delete', exact: true }).click()
      }
    }
    await openDelete()
    const dialog = page.getByRole('alertdialog')
    await dialog.getByText('Delete 10 selected products?', { exact: true }).waitFor()
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await toolbar.getByRole('button', { name: 'Select all 11 matching', exact: true }).click()
    await openDelete()
    await dialog.getByText('Delete all 11 matching products?', { exact: true }).waitFor()
    assert.include(await dialog.innerText(), 'cannot be undone')
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    assert.lengthOf(await Product.all(), 11)
  })

  test('custom destructive actions retain their own consequence text', async ({
    visit,
    browserContext,
    assert,
    cleanup,
  }) => {
    const restock = productResource.actions().find((item) => item.name === 'restock')!
    const original = restock.toJSON
    restock.toJSON = () => ({
      ...original.call(restock),
      destructive: true,
      confirm: 'Adjust this stock level?',
    })
    cleanup(() => {
      restock.toJSON = original
    })
    await browserContext.loginAs(await createUser('admin'))
    const category = await Category.create({ name: 'Kitchen', slug: 'custom-action-context' })
    await insertProducts(category, 1)
    const product = await Product.firstOrFail()
    const page = await visit(`/admin/resources/products/${product.id}`)
    await page.getByRole('button', { name: 'Restock', exact: true }).click()
    const dialog = page.getByRole('alertdialog')
    await dialog.getByText('Adjust this stock level?', { exact: true }).waitFor()
    assert.notInclude(await dialog.innerText(), 'permanently deletes')
    assert.notInclude(await dialog.innerText(), 'cannot be undone')
  })
})
