import { BasePolicy } from '@adonisjs/bouncer'
import type User from '#models/user'
import type Product from '#models/product'

export default class ProductPolicy extends BasePolicy {
  viewList(user: User) {
    return user.role !== 'customer'
  }

  view(_user: User, _product: Product) {
    return true
  }

  create(user: User) {
    return user.role === 'admin'
  }

  update(user: User, _product: Product) {
    return user.role === 'admin' || user.role === 'staff'
  }

  delete(user: User) {
    return user.role === 'admin'
  }

  publish(user: User) {
    return user.role === 'admin'
  }

  restock(user: User, _product: Product) {
    return user.role === 'admin'
  }

  /** The reusable action in app/admin/actions/feature.ts */
  feature(user: User, _product: Product) {
    return user.role === 'admin'
  }
}
