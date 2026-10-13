import { BasePolicy } from '@adonisjs/bouncer'
import type User from '#models/user'
import type Coupon from '#models/coupon'

/**
 * Staff can see coupons; only admins create or change them.
 */
export default class CouponPolicy extends BasePolicy {
  viewList(user: User) {
    return user.role === 'admin' || user.role === 'staff'
  }

  view(user: User, _coupon: Coupon) {
    return user.role === 'admin' || user.role === 'staff'
  }

  create(user: User) {
    return user.role === 'admin'
  }

  update(user: User, _coupon: Coupon) {
    return user.role === 'admin'
  }
}
