import { BasePolicy } from '@adonisjs/bouncer'
import type User from '#models/user'
import demo from '#config/demo'

const DEMO_ACCOUNTS = new Set<string>(Object.values(demo.accounts))

/**
 * With DEMO_MODE on, the accounts behind "Sign in as …" are locked:
 * no one can change their email, password or role.
 */
export function isLockedDemoAccount(user: User) {
  return demo.enabled && DEMO_ACCOUNTS.has(user.email)
}

/**
 * Users, for the public demo's Users resource (DEMO_MODE,
 * app/admin/demo/user_resource.ts). Admins and staff edit users, but
 * only admins change a role; viewers only look. Nobody creates or
 * deletes users here.
 */
export default class UserPolicy extends BasePolicy {
  viewList(user: User) {
    return user.role === 'admin' || user.role === 'staff' || user.role === 'viewer'
  }

  view(user: User, _target: User) {
    return user.role === 'admin' || user.role === 'staff' || user.role === 'viewer'
  }

  update(user: User, target: User) {
    if (isLockedDemoAccount(target)) return false
    return user.role === 'admin' || user.role === 'staff'
  }

  /** The role field's `.ability()`: hidden from staff, never read from their requests */
  changeRole(user: User, target: User) {
    if (isLockedDemoAccount(target)) return false
    return user.role === 'admin'
  }
}
