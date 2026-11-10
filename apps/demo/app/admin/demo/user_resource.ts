/**
 * Users, for the public demo only (DEMO_MODE): start/azu.ts registers it
 * then, so it's outside the autoloaded app/admin/resources. It shows the
 * roles side by side, and the locked demo accounts (UserPolicy).
 */
import { column, defineResource, field, filter } from '@mezielabs/azu'
import User from '#models/user'
import UserPolicy from '#policies/user_policy'
import { updateUserValidator } from '#validators/user'

const ROLES = {
  admin: 'Admin',
  staff: 'Editor (staff)',
  viewer: 'Viewer',
  customer: 'Customer',
}

export default defineResource(User, {
  label: 'Users',
  group: 'Settings',
  icon: 'users',
  title: 'email',
  search: ['fullName', 'email'],
  policy: UserPolicy,
  validators: { update: updateUserValidator },

  columns: [
    column.text('fullName').label('Name').sortable(),
    column.text('email').sortable(),
    column
      .badge('role')
      .colors({ admin: 'red', staff: 'blue', viewer: 'yellow', customer: 'gray' }),
    column.datetime('createdAt').label('Joined').sortable(),
  ],

  fields: [
    field.text('fullName').label('Name'),
    field.text('email'),
    // Admins only: staff edit a user's name and email, not their role
    field.select('role').options(ROLES).ability('changeRole'),
  ],

  filters: [filter.select('role', ROLES)],
})
