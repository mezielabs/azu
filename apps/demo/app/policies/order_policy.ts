import { BasePolicy } from '@adonisjs/bouncer'
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
}
