import { randomUUID } from 'node:crypto'
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import Coupon from '#models/coupon'
import Order from '#models/order'
import { createUser } from './helpers.ts'

const COUPONS = '/admin/resources/coupons'

/**
 * A code no other test (or the seeder) uses
 */
function uniqueCode(prefix = 'T') {
  return `${prefix}${randomUUID().slice(0, 8).toUpperCase()}`
}

function createCoupon(overrides: Partial<Coupon> = {}) {
  return Coupon.create({
    code: uniqueCode(),
    description: 'Ten off',
    kind: 'percent',
    amount: '10.00',
    currency: 'NGN',
    usageLimit: 50,
    isActive: true,
    startsOn: DateTime.fromISO('2026-11-01'),
    expiresAt: DateTime.fromISO('2026-11-30T18:45:00'),
    ...overrides,
  })
}

/**
 * A valid create payload, as the form sends it: decimals as exact
 * strings, datetimes as wall-clock time in the app's timezone.
 */
function couponPayload(overrides: Record<string, unknown> = {}) {
  return {
    code: uniqueCode(),
    description: null,
    kind: 'fixed',
    amount: '1750.50',
    currency: 'GHS',
    usageLimit: 25,
    isActive: false,
    startsOn: '2026-12-01',
    expiresAt: '2026-12-31 23:30:00',
    ...overrides,
  }
}

function errorsOf(response: { body(): any }): Record<string, string[]> {
  return response.body().props.errors
}

test.group('Admin / create (FR-06)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('the form has the fields, with hints from the validator', async ({ client, assert }) => {
    const admin = await createUser('admin')
    const response = await client.get(`${COUPONS}/create`).loginAs(admin).withInertia()

    response.assertStatus(200)
    response.assertInertiaComponent('azu/resource/create')
    const { form, errors } = response.body().props
    assert.deepEqual(errors, {})

    const fields = Object.fromEntries(form.fields.map((f: any) => [f.name, f]))
    assert.deepEqual(Object.keys(fields), [
      'code',
      'description',
      'kind',
      'amount',
      'currency',
      'usageLimit',
      'category',
      'isActive',
      'startsOn',
      'expiresAt',
    ])
    assert.containsSubset(fields.code, { required: true, minLength: 3, maxLength: 32 })
    assert.containsSubset(fields.description, { required: false, maxLength: 500 })
    // Explicit hints win over the validator's: options and step
    assert.deepEqual(fields.kind.options, {
      percent: 'Percent off',
      fixed: 'Fixed amount',
      free_shipping: 'Free shipping',
    })
    assert.containsSubset(fields.amount, { required: true, step: '0.01' })
    assert.containsSubset(fields.usageLimit, { required: false, min: 1, max: 100000, step: 1 })
    assert.containsSubset(fields.startsOn, { required: true })
    assert.containsSubset(fields.expiresAt, { required: false })

    // Field defaults; a switch starts as false without one
    assert.containsSubset(form.values, { isActive: true, code: null, kind: null })
  })

  test('creates through the validator and redirects to the detail page', async ({
    client,
    assert,
  }) => {
    const admin = await createUser('admin')
    const code = uniqueCode('NEW-')
    const response = await client
      .post(`${COUPONS}/create`)
      .loginAs(admin)
      .withInertia()
      .withCsrfToken()
      .json(couponPayload({ code: `  ${code.toLowerCase()} ` }))
      .redirects(0)

    response.assertStatus(303)
    // The validator's output is written, not the raw payload: trimmed and uppercased
    const coupon = await Coupon.findByOrFail('code', code)
    assert.equal(response.header('location'), `${COUPONS}/${coupon.id}`)

    const amount: unknown = coupon.amount
    // Exact on Postgres and MySQL; SQLite stores decimals as numbers
    assert.oneOf(amount, ['1750.50', 1750.5])
    assert.equal(coupon.currency, 'GHS')
    assert.equal(coupon.usageLimit, 25)
    assert.isFalse(Boolean(coupon.isActive))
    assert.equal(coupon.startsOn.toISODate(), '2026-12-01')
    // Wall-clock time in the app's timezone, which is the server's
    assert.equal(coupon.expiresAt?.toFormat('yyyy-MM-dd HH:mm:ss'), '2026-12-31 23:30:00')
  })

  test('only declared fields reach the validator and the database', async ({ client, assert }) => {
    const admin = await createUser('admin')
    const code = uniqueCode()
    const response = await client
      .post(`${COUPONS}/create`)
      .loginAs(admin)
      .withInertia()
      .withCsrfToken()
      .json({ ...couponPayload({ code }), id: 987654, createdAt: '2001-01-01 00:00:00' })
      .redirects(0)

    response.assertStatus(303)
    const coupon = await Coupon.findByOrFail('code', code)
    assert.notEqual(coupon.id, 987654)
    assert.notEqual(coupon.createdAt.year, 2001)
  })

  test('invalid input renders the form again with a 422 and errors', async ({ client, assert }) => {
    const admin = await createUser('admin')
    const taken = await createCoupon()
    const response = await client
      .post(`${COUPONS}/create`)
      .loginAs(admin)
      .withInertia()
      .withCsrfToken()
      .json(couponPayload({ code: taken.code, amount: '12.345', startsOn: null, kind: 'bogus' }))

    response.assertStatus(422)
    response.assertInertiaComponent('azu/resource/create')
    const errors = errorsOf(response)
    assert.sameMembers(Object.keys(errors), ['code', 'amount', 'startsOn', 'kind'])
    assert.match(errors.code[0], /taken/i)
    // Nothing was written: only the original holds the code
    assert.lengthOf(await Coupon.query().where('code', taken.code), 1)
  })

  test('staff can open neither the form nor the submit (CouponPolicy.create)', async ({
    client,
    assert,
  }) => {
    const staff = await createUser('staff')
    const code = uniqueCode()

    const page = await client.get(`${COUPONS}/create`).loginAs(staff).withInertia()
    page.assertStatus(403)
    page.assertInertiaComponent('azu/errors/forbidden')

    const submit = await client
      .post(`${COUPONS}/create`)
      .loginAs(staff)
      .withInertia()
      .withCsrfToken()
      .json(couponPayload({ code }))
    submit.assertStatus(403)
    assert.isNull(await Coupon.findBy('code', code))
  })

  test('a policy without create denies it (OrderPolicy)', async ({ client }) => {
    const admin = await createUser('admin')
    const response = await client.get('/admin/resources/orders/create').loginAs(admin).withInertia()

    response.assertStatus(403)
  })

  test('the list offers New only to users who may create', async ({ client }) => {
    const admin = await createUser('admin')
    const staff = await createUser('staff')

    const asAdmin = await client.get(COUPONS).loginAs(admin).withInertia()
    asAdmin.assertInertiaPropsContains({ abilities: { create: true } })
    const asStaff = await client.get(COUPONS).loginAs(staff).withInertia()
    asStaff.assertInertiaPropsContains({ abilities: { create: false } })
  })

  test('an unknown resource is a 404', async ({ client }) => {
    const admin = await createUser('admin')
    const response = await client.get('/admin/resources/nope/create').loginAs(admin).withInertia()

    response.assertStatus(404)
  })
})

test.group('Admin / detail (FR-06)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('shows the record, read-only, with plain values', async ({ client, assert }) => {
    const staff = await createUser('staff')
    const coupon = await createCoupon({ description: null })
    const response = await client.get(`${COUPONS}/${coupon.id}`).loginAs(staff).withInertia()

    response.assertStatus(200)
    response.assertInertiaComponent('azu/resource/show')
    const { record, fields, abilities } = response.body().props
    assert.equal(record.id, coupon.id)
    assert.equal(record.title, coupon.code)
    assert.lengthOf(fields, 10)
    assert.containsSubset(record.values, {
      description: null,
      kind: 'percent',
      currency: 'NGN',
      usageLimit: 50,
      isActive: true,
      startsOn: '2026-11-01',
    })
    assert.oneOf(record.values.amount, ['10.00', '10'])
    assert.equal(
      DateTime.fromISO(record.values.expiresAt).toFormat('yyyy-MM-dd HH:mm'),
      '2026-11-30 18:45'
    )
    // Staff may view but not update coupons
    assert.deepEqual(abilities, { update: false, actions: [] })
  })

  test('admins get the Edit action', async ({ client }) => {
    const admin = await createUser('admin')
    const coupon = await createCoupon()
    const response = await client.get(`${COUPONS}/${coupon.id}`).loginAs(admin).withInertia()

    response.assertInertiaPropsContains({ abilities: { update: true } })
  })

  test('list rows say whether they link to the detail page', async ({ client, assert }) => {
    const staff = await createUser('staff')
    const coupon = await createCoupon()
    const response = await client
      .get(`${COUPONS}?search=${coupon.code}`)
      .loginAs(staff)
      .withInertia()

    const [row] = response.body().props.list.rows
    assert.isTrue(row.abilities.view)
  })

  test('staff cannot view orders (OrderPolicy.view)', async ({ client }) => {
    const staff = await createUser('staff')
    const customer = await createUser('customer')
    const order = await Order.create({
      userId: customer.id,
      number: `T-${randomUUID().slice(0, 8)}`,
      status: 'paid',
      total: '10.00',
      placedAt: DateTime.now(),
    })

    const response = await client
      .get(`/admin/resources/orders/${order.id}`)
      .loginAs(staff)
      .withInertia()
    response.assertStatus(403)
    response.assertInertiaComponent('azu/errors/forbidden')
  })

  test('a missing record is a 404', async ({ client }) => {
    const admin = await createUser('admin')
    const response = await client.get(`${COUPONS}/2147483000`).loginAs(admin).withInertia()

    response.assertStatus(404)
    response.assertInertiaComponent('azu/errors/not_found')
  })
})

test.group('Admin / edit (FR-06)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('the form starts from the record', async ({ client, assert }) => {
    const admin = await createUser('admin')
    const coupon = await createCoupon()
    const response = await client.get(`${COUPONS}/${coupon.id}/edit`).loginAs(admin).withInertia()

    response.assertStatus(200)
    response.assertInertiaComponent('azu/resource/edit')
    const { record, form } = response.body().props
    assert.deepEqual(record, { id: coupon.id, title: coupon.code })
    assert.containsSubset(form.values, {
      code: coupon.code,
      kind: 'percent',
      usageLimit: 50,
      isActive: true,
      startsOn: '2026-11-01',
    })
  })

  test('updates through the update validator, with { record } as metadata', async ({
    client,
    assert,
  }) => {
    const admin = await createUser('admin')
    const coupon = await createCoupon()
    // Keeping its own code passes the unique rule, which skips meta.record
    const response = await client
      .put(`${COUPONS}/${coupon.id}/edit`)
      .loginAs(admin)
      .withInertia()
      .withCsrfToken()
      .json(couponPayload({ code: coupon.code, amount: '99.90', usageLimit: null }))
      .redirects(0)

    response.assertStatus(303)
    assert.equal(response.header('location'), `${COUPONS}/${coupon.id}`)
    await coupon.refresh()
    assert.oneOf(coupon.amount, ['99.90', 99.9])
    assert.isNull(coupon.usageLimit)
    assert.equal(coupon.kind, 'fixed')
  })

  test("another coupon's code is still taken", async ({ client, assert }) => {
    const admin = await createUser('admin')
    const [coupon, other] = [await createCoupon(), await createCoupon()]
    const response = await client
      .put(`${COUPONS}/${coupon.id}/edit`)
      .loginAs(admin)
      .withInertia()
      .withCsrfToken()
      .json(couponPayload({ code: other.code }))

    response.assertStatus(422)
    response.assertInertiaComponent('azu/resource/edit')
    assert.deepEqual(Object.keys(errorsOf(response)), ['code'])
    await coupon.refresh()
    assert.notEqual(coupon.code, other.code)
  })

  test('staff can open neither the form nor the submit (CouponPolicy.update)', async ({
    client,
    assert,
  }) => {
    const staff = await createUser('staff')
    const coupon = await createCoupon()

    const page = await client.get(`${COUPONS}/${coupon.id}/edit`).loginAs(staff).withInertia()
    page.assertStatus(403)

    const submit = await client
      .put(`${COUPONS}/${coupon.id}/edit`)
      .loginAs(staff)
      .withInertia()
      .withCsrfToken()
      .json(couponPayload({ code: coupon.code, amount: '1.00' }))
    submit.assertStatus(403)
    await coupon.refresh()
    assert.oneOf(coupon.amount, ['10.00', 10])
  })
})

/**
 * No global transaction here: Postgres rejects "not-a-number" for an
 * integer key, which would abort the test's transaction. Azu treats it
 * as a record that can't exist.
 */
test.group('Admin / malformed ids (FR-06)', () => {
  test('a malformed id is a 404', async ({ client }) => {
    const admin = await createUser('admin')
    try {
      for (const path of ['not-a-number', 'not-a-number/edit']) {
        const response = await client.get(`${COUPONS}/${path}`).loginAs(admin).withInertia()
        response.assertStatus(404)
        response.assertInertiaComponent('azu/errors/not_found')
      }
    } finally {
      await admin.delete()
    }
  })
})
