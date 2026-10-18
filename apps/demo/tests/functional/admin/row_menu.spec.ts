import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import Coupon from '#models/coupon'
import Order from '#models/order'
import { createUser } from './helpers.ts'

test.group("Admin / list rows' view and update abilities (row menu)", (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('each row says whether the user may view and update it', async ({ client, assert }) => {
    const admin = await createUser('admin')
    const staff = await createUser('staff')
    const customer = await createUser('customer')
    await Order.create({
      userId: customer.id,
      number: 'MENU-1',
      status: 'paid',
      total: '10.00',
      placedAt: DateTime.now(),
    })
    await Coupon.create({
      code: 'MENU10',
      kind: 'percent',
      amount: '10.00',
      currency: 'NGN',
      isActive: true,
      startsOn: DateTime.fromISO('2026-10-01'),
    })

    // OrderPolicy has view but no update: View only
    const orders = await client.get('/admin/resources/orders').loginAs(admin).withInertia()
    assert.containsSubset(orders.body().props.list.rows[0].abilities, { view: true, update: false })

    // Forbidden: staff may view coupons but not update them
    const coupons = await client.get('/admin/resources/coupons').loginAs(staff).withInertia()
    assert.containsSubset(coupons.body().props.list.rows[0].abilities, {
      view: true,
      update: false,
    })
    const asAdmin = await client.get('/admin/resources/coupons').loginAs(admin).withInertia()
    assert.containsSubset(asAdmin.body().props.list.rows[0].abilities, { view: true, update: true })
  })
})
