import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { defineScreen, field, type AzuConfig } from '@mezielabs/azu'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import { manageSettings } from '#abilities/main'
import Setting from '#models/setting'
import { createUser, withScreen } from './helpers.ts'

const SETTINGS = '/admin/screens/store-settings'

/** A valid save of every writable field */
function payload(overrides: Record<string, unknown> = {}) {
  return {
    storeName: 'Iya Basira Stores',
    supportEmail: 'care@azu.test',
    currency: 'GHS',
    vatRate: '12.50',
    maintenanceMode: true,
    checkoutAnnouncement: '<p>Closed on <strong>Sunday</strong>.</p>',
    ...overrides,
  }
}

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
 * The store-settings screen's form, with its validator and `save`
 * watched for one test
 */
async function spyOnSettings(cleanup: (callback: () => void) => void) {
  const azu = await app.container.make('azu')
  const form = azu.screens.get('store-settings')!.form!
  const validated: Record<string, unknown>[] = []
  const saved: Record<string, unknown>[] = []
  const { validator, save } = form
  const validate = validator.validate
  validator.validate = (data: any, options?: any) => {
    validated.push({ ...data })
    return validate.call(validator, data, options)
  }
  form.save = (input: any, ctx) => {
    saved.push({ ...input })
    return save(input, ctx)
  }
  cleanup(() => {
    validator.validate = validate
    form.save = save
  })
  return { validated, saved }
}

/**
 * Screen forms (FR-23), through the demo's Store settings screen
 */
test.group('Admin / screen forms (FR-23)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test("the form renders with load's values and the validator's hints", async ({
    client,
    assert,
  }) => {
    await seedSettings()
    const admin = await createUser('admin')
    const response = await client.get(SETTINGS).loginAs(admin).withInertia()
    response.assertStatus(200)
    response.assertInertiaComponent('azu/screen')

    const { screen, form, errors } = response.body().props
    assert.include(screen, {
      name: 'store-settings',
      group: 'Settings',
      component: null,
      form: true,
    })
    assert.deepEqual(errors, {})
    assert.equal(form.successMessage, 'Store settings saved')
    assert.deepEqual(form.values, {
      storeName: 'Azu Store',
      supportEmail: 'help@azu.test',
      currency: 'NGN',
      vatRate: '7.50',
      maintenanceMode: false,
      checkoutAnnouncement: '<p>Free delivery in Lagos</p>',
      lastChangedAt: '2026-10-01T09:00:00.000Z',
    })
    const byName = Object.fromEntries(form.fields.map((item: any) => [item.name, item]))
    assert.include(byName.storeName, { required: true, minLength: 2, maxLength: 80 })
    assert.include(byName.vatRate, { kind: 'decimal', min: 0, max: 100, required: true })
    assert.include(byName.checkoutAnnouncement, { required: false })
    assert.include(byName.lastChangedAt, { readOnly: true, label: 'Last changed' })
  })

  test('a valid save is a 303 back to the screen, which shows the stored values', async ({
    client,
    assert,
  }) => {
    await seedSettings()
    const admin = await createUser('admin')
    const before = DateTime.now().minus({ seconds: 1 })
    const response = await client
      .put(SETTINGS)
      .loginAs(admin)
      .withCsrfToken()
      .withInertia()
      .json(payload())
      .redirects(0)
    response.assertStatus(303)
    assert.equal(response.header('location'), SETTINGS)

    const stored = await Setting.values(['storeName', 'currency', 'vatRate', 'maintenanceMode'])
    assert.deepEqual(stored, {
      storeName: 'Iya Basira Stores',
      currency: 'GHS',
      vatRate: '12.50',
      maintenanceMode: true,
    })
    // save sets "last changed" itself
    const { lastChangedAt } = await Setting.values(['lastChangedAt'])
    assert.isTrue(lastChangedAt! >= before)

    const after = await client.get(SETTINGS).loginAs(admin).withInertia()
    const { form } = after.body().props
    assert.include(form.values, { storeName: 'Iya Basira Stores', vatRate: '12.50' })
    assert.equal(DateTime.fromISO(form.values.lastChangedAt).toMillis(), lastChangedAt!.toMillis())
    // The toast the form shows once the visit succeeds
    assert.equal(form.successMessage, 'Store settings saved')
  })

  test('an invalid save is a 422 with errors under each field, and nothing stored', async ({
    client,
    assert,
  }) => {
    await seedSettings()
    const admin = await createUser('admin')
    const response = await client
      .put(SETTINGS)
      .loginAs(admin)
      .withCsrfToken()
      .withInertia()
      .json(
        payload({ storeName: 'A', supportEmail: 'not-an-email', vatRate: '120', currency: 'XYZ' })
      )
    response.assertStatus(422)
    response.assertInertiaComponent('azu/screen')
    const { errors, form } = response.body().props
    assert.deepEqual(errors, {
      storeName: ['Store name must be at least 2 characters'],
      supportEmail: ['Support email must be an email address'],
      currency: ['Currency must be one of the options'],
      vatRate: ['VAT rate must be 100 or less'],
    })
    // The form is still there; the client keeps what was typed on a 422
    assert.isNotNull(form)
    const { storeName } = await Setting.values(['storeName'])
    assert.equal(storeName, 'Azu Store')
  })

  test('staff get 403 on GET and on PUT, and nothing is stored', async ({ client, assert }) => {
    await seedSettings()
    const staff = await createUser('staff')
    const page = await client.get(SETTINGS).loginAs(staff).withInertia()
    page.assertStatus(403)
    page.assertInertiaComponent('azu/errors/forbidden')

    const save = await client
      .put(SETTINGS)
      .loginAs(staff)
      .withCsrfToken()
      .withInertia()
      .json(payload())
    save.assertStatus(403)
    const { storeName } = await Setting.values(['storeName'])
    assert.equal(storeName, 'Azu Store')

    // Not in staff's navigation either
    const list = await client.get('/admin/resources/products').loginAs(staff).withInertia()
    const groups = list.body().props.azu.navigation.map((entry: { label: string }) => entry.label)
    assert.notInclude(groups, 'Settings')
  })

  test('a PUT to a component screen, or no screen, is a 404', async ({ client }) => {
    const admin = await createUser('admin')
    for (const url of ['/admin/screens/sales-report', '/admin/screens/nope']) {
      const response = await client
        .put(url)
        .loginAs(admin)
        .withCsrfToken()
        .withInertia()
        .json(payload())
      response.assertStatus(404)
    }
  })

  test('undeclared input never reaches the validator or save', async ({
    client,
    assert,
    cleanup,
  }) => {
    await seedSettings()
    const { validated, saved } = await spyOnSettings(cleanup)
    const admin = await createUser('admin')
    const response = await client
      .put(SETTINGS)
      .loginAs(admin)
      .withCsrfToken()
      .withInertia()
      .json(payload({ role: 'admin', isAdmin: true }))
      .redirects(0)
    response.assertStatus(303)

    assert.lengthOf(validated, 1)
    assert.notProperty(validated[0], 'role')
    assert.notProperty(validated[0], 'isAdmin')
    assert.lengthOf(saved, 1)
    assert.notProperty(saved[0], 'role')
    assert.notProperty(saved[0], 'isAdmin')
    assert.notProperty(saved[0], 'lastChangedAt')
    assert.sameMembers(Object.keys(saved[0]), Object.keys(payload()))
  })

  test("a read-only field sent in the request is ignored: load's value reaches the validator", async ({
    client,
    assert,
    cleanup,
  }) => {
    await seedSettings()
    const { validated } = await spyOnSettings(cleanup)
    const admin = await createUser('admin')
    await client
      .put(SETTINGS)
      .loginAs(admin)
      .withCsrfToken()
      .withInertia()
      .json(payload({ lastChangedAt: '1999-01-01T00:00:00.000Z' }))
      .redirects(0)

    // load's value, in the format vine.date() reads, never the request's
    assert.notInclude(String(validated[0].lastChangedAt), '1999')
    const { lastChangedAt } = await Setting.values(['lastChangedAt'])
    assert.isAbove(lastChangedAt!.year, 2025)
  })

  test('rich text is sanitised before the validator and save', async ({ client, assert }) => {
    await seedSettings()
    const admin = await createUser('admin')
    await client
      .put(SETTINGS)
      .loginAs(admin)
      .withCsrfToken()
      .withInertia()
      .json(
        payload({
          checkoutAnnouncement:
            '<p onclick="steal()">Sale<script>alert(1)</script> <a href="javascript:alert(1)">now</a></p>',
        })
      )
      .redirects(0)

    const { checkoutAnnouncement } = await Setting.values(['checkoutAnnouncement'])
    assert.notInclude(checkoutAnnouncement!, '<script')
    assert.notInclude(checkoutAnnouncement!, 'onclick')
    assert.notInclude(checkoutAnnouncement!, 'javascript:')
    assert.include(checkoutAnnouncement!, 'Sale')
  })
})

test.group('Admin / screen form datetimes (FR-23)', (group) => {
  const config = app.config.get<AzuConfig>('azu')
  const original = config.timezone

  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.teardown(() => {
    config.timezone = original
  })

  test("a datetime round-trips in the admin's timezone", async ({ client, assert, cleanup }) => {
    config.timezone = 'Africa/Lagos'
    const stored: { launchAt: DateTime | null } = { launchAt: null }
    await withScreen(
      'zz-launch',
      defineScreen({
        label: 'Launch',
        ability: manageSettings,
        form: {
          fields: [field.datetime('launchAt')],
          validator: vine.create({ launchAt: vine.date() }),
          load: () => stored,
          save: (input) => {
            stored.launchAt = input.launchAt
          },
        },
      }),
      cleanup
    )
    const admin = await createUser('admin')
    // 09:00 in Lagos, as the picker submits it: the exact instant
    const picked = DateTime.fromISO('2026-12-01T09:00', { zone: 'Africa/Lagos' }).toUTC().toISO()
    const response = await client
      .put('/admin/screens/zz-launch')
      .loginAs(admin)
      .withCsrfToken()
      .withInertia()
      .json({ launchAt: picked })
      .redirects(0)
    response.assertStatus(303)
    assert.equal(stored.launchAt!.toUTC().toISO(), '2026-12-01T08:00:00.000Z')

    const page = await client.get('/admin/screens/zz-launch').loginAs(admin).withInertia()
    const shown = DateTime.fromISO(page.body().props.form.values.launchAt)
    assert.equal(shown.setZone('Africa/Lagos').toFormat('yyyy-MM-dd HH:mm'), '2026-12-01 09:00')
  })
})
