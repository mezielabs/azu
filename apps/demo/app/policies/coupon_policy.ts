import { BasePolicy } from '@adonisjs/bouncer'
import type User from '#models/user'
import type Coupon from '#models/coupon'

/**
 * Staff and viewers can see coupons; only admins create or change them.
 */
export default class CouponPolicy extends BasePolicy {
  viewList(user: User) {
    return user.role === 'admin' || user.role === 'staff' || user.role === 'viewer'
  }

  view(user: User, _coupon: Coupon) {
    return user.role === 'admin' || user.role === 'staff' || user.role === 'viewer'
  }

  create(user: User) {
    return user.role === 'admin'
  }

  update(user: User, _coupon: Coupon) {
    return user.role === 'admin'
  }

  /** The built-in Delete (FR-12) */
  delete(user: User, _coupon: Coupon) {
    return user.role === 'admin'
  }
}
