import { BasePolicy } from '@adonisjs/bouncer'
import type User from '#models/user'

export default class CategoryPolicy extends BasePolicy {
  viewList(user: User) {
    return user.role === 'admin' || user.role === 'staff'
  }

  view(_user: User) {
    return true
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
