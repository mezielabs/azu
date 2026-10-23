import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Category from '#models/category'
import Product from '#models/product'
import { createUser } from '../functional/admin/helpers.ts'

test.group('Login return journey', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  for (const target of ['home', 'edit'] as const) {
    test(`signing in returns to the bookmarked admin ${target}`, async ({ visit }) => {
      const admin = await createUser('admin')
      let destination = '/admin'
      if (target === 'edit') {
        const category = await Category.create({ name: 'Kitchen', slug: 'login-kitchen' })
        const product = await Product.create({
          categoryId: category.id,
          name: 'Clay pot',
          sku: 'LOGIN-POT',
          price: '12.50',
          stock: 3,
          status: 'draft',
          isFeatured: false,
        })
        destination = `/admin/resources/products/${product.id}/edit`
      }
      const page = await visit(destination)
      await page.waitForURL('**/login')
      await page.getByLabel('Email', { exact: true }).fill(admin.email)
      await page.getByLabel('Password', { exact: true }).fill('secret-password')
      await page.getByRole('button', { name: 'Sign in', exact: true }).click()
      await page.waitForURL(`**${destination}`)
      await page
        .getByRole('heading', { level: 1, name: target === 'home' ? 'Overview' : 'Edit Clay pot' })
        .waitFor()
      if (target === 'edit') await page.getByRole('textbox', { name: /^Name/ }).waitFor()
    })
  }
})
