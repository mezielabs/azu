import { test } from '@japa/runner'
import ace from '@adonisjs/core/services/ace'
import drive from '@adonisjs/drive/services/main'
import DemoReset from '#commands/demo_reset'
import Category from '#models/category'
import Product from '#models/product'
import Setting from '#models/setting'
import User from '#models/user'
import { clearRateLimits, demoAccount, runDemoReset } from './helpers.ts'

/**
 * `node ace demo:reset` (DEMO_MODE): the host runs it every hour. It
 * empties the uploads disk, runs migration:fresh with the seeders, and
 * records the time for the banner, leaving a working demo.
 */
test.group('Demo / demo:reset', (group) => {
  group.each.setup(() => clearRateLimits())

  test('puts back the seeded store and records the time', async ({ assert }) => {
    // What a visitor leaves behind
    await Category.create({ name: 'Visitor category', slug: 'visitor-category' })
    const viewer = await demoAccount('viewer')
    await User.query().where('id', viewer.id).update({ full_name: 'Changed' })

    const command = await runDemoReset()
    command.assertSucceeded()

    assert.isNull(await Category.findBy('slug', 'visitor-category'))
    const viewerAfter = await demoAccount('viewer')
    assert.equal(viewerAfter.fullName, 'Val Viewer')
    assert.lengthOf(await Product.all(), 40)
    for (const role of ['admin', 'editor', 'viewer'] as const) {
      assert.isNotNull(await demoAccount(role))
    }

    const { demoResetAt } = await Setting.values(['demoResetAt'])
    assert.isNotNull(demoResetAt)
    assert.isBelow(Math.abs(demoResetAt!.diffNow().as('seconds')), 60)
  })

  test('empties the disk it resets', async ({ assert }) => {
    // A fake disk, so the developer's real storage stays put
    const disk = drive.fake()
    try {
      await disk.put('products/thumbnail/visitor.png', 'not really a png')
      await ace.boot()
      ace.ui.switchMode('raw')
      const command = await ace.create(DemoReset, [])
      await command.exec()
      command.assertSucceeded()

      assert.isFalse(await disk.exists('products/thumbnail/visitor.png'))
      // The seeder's thumbnails are back
      assert.isTrue(await disk.exists('seed/products/01.svg'))
    } finally {
      drive.restore()
    }
  })

  test('leaves a working demo: sign in as Admin and open the panel', async ({ client }) => {
    const response = await client.post('/demo/sign-in/admin').withCsrfToken().redirects(0)
    response.assertStatus(302)

    const admin = await demoAccount('admin')
    const panel = await client.get('/admin').loginAs(admin).withInertia()
    panel.assertStatus(200)
    panel.assertInertiaComponent('azu/screen')

    const products = await client.get('/admin/resources/products').loginAs(admin).withInertia()
    products.assertStatus(200)
  })
})
