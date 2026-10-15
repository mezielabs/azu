import { BasePolicy } from '@adonisjs/bouncer'
import type Order from '#models/order'
import type User from '#models/user'

/**
 * Orders are for admins only: staff can open the panel but not this.
 */
export default class OrderPolicy extends BasePolicy {
  viewList(user: User) {
    return user.role === 'admin'
  }

  view(user: User) {
    return user.role === 'admin'
  }

  /**
   * Per record: an order that's already cancelled can't be cancelled
   * again, so a bulk cancel skips it and says so (FR-12).
   */
  cancel(user: User, order: Order) {
    return user.role === 'admin' && order.status !== 'cancelled'
  }
}
