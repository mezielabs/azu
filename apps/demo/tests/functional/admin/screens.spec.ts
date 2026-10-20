import { execFile } from 'node:child_process'
import { rm } from 'node:fs/promises'
import { promisify } from 'node:util'
import { test } from '@japa/runner'
import ace from '@adonisjs/core/services/ace'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { Bouncer } from '@adonisjs/bouncer'
import { defineScreen } from '@mezielabs/azu'
import type { AzuConfig } from '@mezielabs/azu/types'
import { DateTime } from 'luxon'
import Order from '#models/order'
import { createUser, withHome, withScreen } from './helpers.ts'

const REPORT = '/admin/screens/sales-report'

const labels = (navigation: { items: { label: string }[] }[]) =>
  navigation.flatMap((group) => group.items.map((item) => item.label))

/**
 * Custom screens (FR-20), navigation links (FR-21) and the home screen
 * (FR-22), through the demo's Overview and Sales report.
 */
test.group('Admin / screens (FR-20, FR-21, FR-22)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('a screen renders for a user who passes its ability, with its data', async ({
    client,
    assert,
  }) => {
    const admin = await createUser('admin')
    const customer = await createUser('customer')
    await Order.create({
      userId: customer.id,
      number: 'AZU-SCREEN-1',
      status: 'paid',
      total: '1250.50',
      placedAt: DateTime.now().minus({ hours: 1 }),
    })

    const response = await client.get(REPORT).loginAs(admin).withInertia()
    response.assertStatus(200)
    response.assertInertiaComponent('azu/screen')
    const { screen, data } = response.body().props
    assert.deepEqual(screen, {
      name: 'sales-report',
      label: 'Sales report',
      group: 'Reports',
      icon: 'chart-column',
      component: 'SalesReport',
      form: false,
      widgets: false,
    })
    assert.equal(data.days, 7)
    assert.lengthOf(data.rows, 7)
    assert.isAtLeast(data.orders, 1)

    // The range comes from the query string
    const month = await client.get(`${REPORT}?days=30`).loginAs(admin).withInertia()
    assert.equal(month.body().props.data.days, 30)
    assert.lengthOf(month.body().props.data.rows, 30)
    const forged = await client.get(`${REPORT}?days=9999`).loginAs(admin).withInertia()
    assert.equal(forged.body().props.data.days, 7)
  })

  test('a user who fails the ability gets a 403, and no link to it', async ({ client, assert }) => {
    const staff = await createUser('staff')
    const response = await client.get(REPORT).loginAs(staff).withInertia()
    response.assertStatus(403)
    response.assertInertiaComponent('azu/errors/forbidden')
    assert.isUndefined(response.body().props.data)

    const home = await client.get('/admin').loginAs(staff).withInertia()
    const navigation = home.body().props.azu.navigation
    assert.notInclude(labels(navigation), 'Sales report')
    assert.notInclude(
      navigation.map((entry: { label: string | null }) => entry.label),
      'Reports'
    )
  })

  test('an unknown screen is a 404', async ({ client }) => {
    const admin = await createUser('admin')
    const response = await client.get('/admin/screens/nowhere').loginAs(admin).withInertia()
    response.assertStatus(404)
    response.assertInertiaComponent('azu/errors/not_found')
  })

  test('a screen whose ability throws is denied', async ({ client, assert, cleanup }) => {
    await withScreen(
      'zz-throwing',
      defineScreen({
        label: 'Throwing',
        ability: Bouncer.ability(() => {
          throw new Error('the ability failed')
        }),
        component: 'Overview',
      }),
      cleanup
    )
    const admin = await createUser('admin')
    const response = await client.get('/admin/screens/zz-throwing').loginAs(admin).withInertia()
    response.assertStatus(403)
    const home = await client.get('/admin').loginAs(admin).withInertia()
    assert.notInclude(labels(home.body().props.azu.navigation), 'Throwing')
  })

  test('a partial reload of data computes it without the shared azu props', async ({
    client,
    assert,
  }) => {
    const admin = await createUser('admin')
    const response = await client
      .get(`${REPORT}?days=90`)
      .loginAs(admin)
      .withInertiaPartialReload('azu/screen', ['data'])
    response.assertStatus(200)
    const props = response.body().props
    assert.equal(props.data.days, 90)
    assert.notProperty(props, 'azu')
  })

  test('links show to users who pass their ability, which only hides them', async ({
    client,
    assert,
  }) => {
    const [admin, staff] = [await createUser('admin'), await createUser('staff')]
    const adminHome = await client.get('/admin').loginAs(admin).withInertia()
    assert.includeMembers(labels(adminHome.body().props.azu.navigation), [
      'Awaiting shipping',
      'Azu documentation',
    ])
    const staffHome = await client.get('/admin').loginAs(staff).withInertia()
    const staffLabels = labels(staffHome.body().props.azu.navigation)
    // viewOrders hides the link; the docs link has no ability
    assert.notInclude(staffLabels, 'Awaiting shipping')
    assert.include(staffLabels, 'Azu documentation')
    // The target guards itself: OrderPolicy still denies staff the list
    const list = await client
      .get('/admin/resources/orders?status=paid')
      .loginAs(staff)
      .withInertia()
    list.assertStatus(403)
  })

  test('home: renders the screen at /admin, or redirects to a resource', async ({
    client,
    assert,
    cleanup,
  }) => {
    const admin = await createUser('admin')
    const home = await client.get('/admin').loginAs(admin).withInertia().redirects(0)
    home.assertStatus(200)
    home.assertInertiaComponent('azu/screen')
    assert.equal(home.body().props.screen.name, 'overview')
    assert.equal(home.body().url, '/admin')

    withHome({ resource: 'orders' }, cleanup)
    const redirected = await client.get('/admin').loginAs(admin).redirects(0)
    redirected.assertStatus(302)
    assert.equal(redirected.header('location'), '/admin/resources/orders')
  })

  test("home: a user who fails the home screen's ability gets the welcome page", async ({
    client,
    cleanup,
  }) => {
    // Admins only: staff get the welcome page, not a 403
    withHome('sales-report', cleanup)
    const staff = await createUser('staff')
    const response = await client.get('/admin').loginAs(staff).withInertia()
    response.assertStatus(200)
    response.assertInertiaComponent('azu/dashboard')
    response.assertInertiaPropsContains({ azu: { home: null } })
  })

  test("home: a user who can't list the home resource gets the welcome page, not a redirect", async ({
    client,
    cleanup,
  }) => {
    // OrderPolicy's viewList is admins only
    withHome({ resource: 'orders' }, cleanup)
    const staff = await createUser('staff')
    const response = await client.get('/admin').loginAs(staff).withInertia().redirects(0)
    response.assertStatus(200)
    response.assertInertiaComponent('azu/dashboard')

    // A resource staff may list still redirects (withHome's cleanup restores home)
    app.config.get<AzuConfig>('azu').home = { resource: 'products' }
    const products = await client.get('/admin').loginAs(staff).redirects(0)
    products.assertStatus(302)
    products.assertHeader('location', '/admin/resources/products')
  })
})

test.group('Admin / azu:screen output (FR-20)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('compiles as written and renders', async ({ client, assert, cleanup }) => {
    const files = [
      app.makePath('app/admin/screens/zz_generated.ts'),
      app.makePath('inertia/admin/components/zz_generated.tsx'),
    ]
    cleanup(async () => {
      for (const file of files) await rm(file, { force: true })
    })
    await ace.boot()
    ace.ui.switchMode('raw')
    const command = await ace.create(await ace.find('azu:screen'), ['ZzGenerated'])
    await command.exec()
    ace.ui.switchMode('normal')
    command.assertSucceeded()

    // Both projects compile, the component typed from the screen's data
    const tsc = app.makePath('node_modules/.bin/tsc')
    await promisify(execFile)(tsc, ['--noEmit'], { cwd: app.makePath() })
    await promisify(execFile)(tsc, ['--noEmit', '--project', 'inertia/tsconfig.json'], {
      cwd: app.makePath(),
    })

    // Mounted for this test only
    const { default: generated } = await import(files[0])
    await withScreen('zz-generated', generated, cleanup)

    const admin = await createUser('admin')
    const response = await client.get('/admin/screens/zz-generated').loginAs(admin).withInertia()
    response.assertStatus(200)
    response.assertInertiaComponent('azu/screen')
    assert.equal(response.body().props.screen.component, 'ZzGenerated')
    assert.isString(response.body().props.data.generatedAt)
  }).timeout(180_000)
})

test.group('Admin / azu:screen --form output (FR-23)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('compiles as written, renders and saves', async ({ client, assert, cleanup }) => {
    const files = [
      app.makePath('app/admin/screens/zz_generated_form.ts'),
      app.makePath('app/validators/zz_generated_form.ts'),
    ]
    cleanup(async () => {
      for (const file of files) await rm(file, { force: true })
    })
    await ace.boot()
    ace.ui.switchMode('raw')
    const command = await ace.create(await ace.find('azu:screen'), ['ZzGeneratedForm', '--form'])
    await command.exec()
    ace.ui.switchMode('normal')
    command.assertSucceeded()

    const tsc = app.makePath('node_modules/.bin/tsc')
    await promisify(execFile)(tsc, ['--noEmit'], { cwd: app.makePath() })

    const { default: generated } = await import(files[0])
    await withScreen('zz-generated-form', generated, cleanup)

    const admin = await createUser('admin')
    const url = '/admin/screens/zz-generated-form'
    const response = await client.get(url).loginAs(admin).withInertia()
    response.assertStatus(200)
    assert.deepEqual(response.body().props.form.values, {
      title: 'Zz generated form',
      enabled: false,
    })

    const saved = await client
      .put(url)
      .loginAs(admin)
      .withCsrfToken()
      .json({ title: 'Renamed', enabled: true })
      .redirects(0)
    saved.assertStatus(303)
    const after = await client.get(url).loginAs(admin).withInertia()
    assert.deepEqual(after.body().props.form.values, { title: 'Renamed', enabled: true })
  }).timeout(180_000)
})
