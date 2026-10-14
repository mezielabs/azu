import { BasePolicy } from '@adonisjs/bouncer'
import type User from '#models/user'

/**
 * Categories are for admins only. Staff edit products but can't list
 * categories, so a product's category is read-only for them (FR-08).
 */
export default class CategoryPolicy extends BasePolicy {
  viewList(user: User) {
    return user.role === 'admin'
  }

  view(user: User) {
    return user.role === 'admin'
  }

  create(user: User) {
    return user.role === 'admin'
  }

  update(user: User) {
    return user.role === 'admin'
  }

  delete(user: User) {
    return user.role === 'admin'
  }
}
