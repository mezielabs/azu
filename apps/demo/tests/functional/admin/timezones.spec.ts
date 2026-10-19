import { randomUUID } from 'node:crypto'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import type { AzuConfig } from '@mezielabs/azu'
import { DateTime } from 'luxon'
import Coupon from '#models/coupon'
import { createUser } from './helpers.ts'

const COUPONS = '/admin/resources/coupons'

/**
 * What the datetime picker submits for a wall-clock time the user
 * entered in `zone`: the exact instant. React Aria's `ZonedDateTime`
 * resolves the wall-clock time, and the form sends
 * `toAbsoluteString()`. Luxon stands in for it here.
 */
function pickerValue(wallClock: string, zone: string) {
  return DateTime.fromISO(wallClock, { zone }).toUTC().toISO()
}

function payload(code: string, expiresAt: string | null) {
  return {
    code,
    description: null,
    kind: 'percent',
    amount: '10.00',
    currency: 'NGN',
    usageLimit: null,
    isActive: true,
    startsOn: '2026-10-01',
    expiresAt,
  }
}

/**
 * The server process runs in UTC (`TZ=UTC` in .env.test) while the
 * admin's timezone (`timezone` in config/azu.ts) is something else.
 * A datetime the user enters in the admin's timezone must be stored as
 * that exact instant.
 */
test.group('Admin / datetimes in the app timezone (FR-06)', (group) => {
  const config = app.config.get<AzuConfig>('azu')
  const original = config.timezone

  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.teardown(() => {
    config.timezone = original
  })

  /**
   * An admin, a coupon to edit, and the admin timezone for this test
   */
  async function setUp(timezone: string) {
    config.timezone = timezone
    const admin = await createUser('admin')
    const coupon = await Coupon.create({
      code: `TZ${randomUUID().slice(0, 8).toUpperCase()}`,
      kind: 'percent',
      amount: '10.00',
      currency: 'NGN',
      isActive: true,
      startsOn: DateTime.fromISO('2026-10-01'),
      expiresAt: null,
    })

    return { admin, coupon }
  }

  test('the server process runs in UTC', ({ assert }) => {
    assert.equal(Intl.DateTimeFormat().resolvedOptions().timeZone, 'UTC')
  })

  test('Africa/Lagos: the stored instant is the wall-clock time entered', async ({
    client,
    assert,
  }) => {
    const { admin, coupon } = await setUp('Africa/Lagos')

    const response = await client
      .put(`${COUPONS}/${coupon.id}/edit`)
      .loginAs(admin)
      .withInertia()
      .withCsrfToken()
      .json(payload(coupon.code, pickerValue('2026-11-05T14:30', 'Africa/Lagos')))
      .redirects(0)

    response.assertStatus(303)
    await coupon.refresh()
    assert.equal(coupon.expiresAt!.toUTC().toISO(), '2026-11-05T13:30:00.000Z')
    assert.equal(
      coupon.expiresAt!.setZone('Africa/Lagos').toFormat('yyyy-MM-dd HH:mm'),
      '2026-11-05 14:30'
    )

    // The edit form reads it back as the same wall-clock time
    const edit = await client.get(`${COUPONS}/${coupon.id}/edit`).loginAs(admin).withInertia()
    const { azu, form } = edit.body().props
    assert.equal(azu.timezone, 'Africa/Lagos')
    assert.equal(
      DateTime.fromISO(form.values.expiresAt).setZone('Africa/Lagos').toFormat('yyyy-MM-dd HH:mm'),
      '2026-11-05 14:30'
    )
  })

  /**
   * London leaves BST at 02:00 BST on 2026-10-25 (01:00 UTC), so 01:30
   * happens twice: 01:30 BST (00:30 UTC), then 01:30 GMT (01:30 UTC).
   */
  for (const [label, wallClock, offset, instant] of [
    ['the day before, BST', '2026-10-24T09:15', '+01:00', '2026-10-24T08:15:00.000Z'],
    ['the first 01:30, BST', '2026-10-25T01:30', '+01:00', '2026-10-25T00:30:00.000Z'],
    ['the repeated 01:30, GMT', '2026-10-25T01:30', '+00:00', '2026-10-25T01:30:00.000Z'],
    ['after the change, GMT', '2026-10-25T02:30', '+00:00', '2026-10-25T02:30:00.000Z'],
  ]) {
    test(`Europe/London across the DST change: ${label}`, async ({ client, assert }) => {
      const { admin, coupon } = await setUp('Europe/London')
      // The picker tells the two 01:30s apart by offset
      const submitted = DateTime.fromISO(`${wallClock}${offset}`).toUTC().toISO()

      const response = await client
        .put(`${COUPONS}/${coupon.id}/edit`)
        .loginAs(admin)
        .withInertia()
        .withCsrfToken()
        .json(payload(coupon.code, submitted))
        .redirects(0)

      response.assertStatus(303)
      await coupon.refresh()
      assert.equal(coupon.expiresAt!.toUTC().toISO(), instant)
      assert.equal(
        coupon.expiresAt!.setZone('Europe/London').toFormat("yyyy-MM-dd'T'HH:mm"),
        wallClock
      )
    })
  }

  test('a wall-clock string is read in the app timezone', async ({ client, assert }) => {
    const { admin, coupon } = await setUp('Africa/Lagos')

    const response = await client
      .put(`${COUPONS}/${coupon.id}/edit`)
      .loginAs(admin)
      .withInertia()
      .withCsrfToken()
      .json(payload(coupon.code, '2026-11-05 14:30:00'))
      .redirects(0)

    response.assertStatus(303)
    await coupon.refresh()
    assert.equal(coupon.expiresAt!.toUTC().toISO(), '2026-11-05T13:30:00.000Z')
  })

  test('an ambiguous wall-clock string takes the first occurrence', async ({ client, assert }) => {
    const { admin, coupon } = await setUp('Europe/London')

    const response = await client
      .put(`${COUPONS}/${coupon.id}/edit`)
      .loginAs(admin)
      .withInertia()
      .withCsrfToken()
      .json(payload(coupon.code, '2026-10-25 01:30:00'))
      .redirects(0)

    response.assertStatus(303)
    await coupon.refresh()
    assert.equal(coupon.expiresAt!.toUTC().toISO(), '2026-10-25T00:30:00.000Z')
  })
})
