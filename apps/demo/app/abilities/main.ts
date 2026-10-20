/*
|--------------------------------------------------------------------------
| Bouncer abilities
|--------------------------------------------------------------------------
|
| You may export multiple abilities from this file and pre-register them
| when creating the Bouncer instance.
|
*/

import { Bouncer } from '@adonisjs/bouncer'
import type User from '#models/user'

/**
 * Who can open the admin panel. Azu's installer will add this ability
 * returning `false`; the demo lets admins and staff in.
 */
export const accessAdmin = Bouncer.ability((user: User) => {
  return user.role === 'admin' || user.role === 'staff'
})

/**
 * Who can see the Reports screens (FR-20): admins, not staff.
 */
export const viewReports = Bouncer.ability((user: User) => {
  return user.role === 'admin'
})

/**
 * Who sees the "Awaiting shipping" link (FR-21): admins, as
 * OrderPolicy's viewList. It only hides the link; OrderPolicy still
 * guards the list it opens.
 */
export const viewOrders = Bouncer.ability((user: User) => {
  return user.role === 'admin'
})

/**
 * Who can change the store's settings (FR-23): admins. Its own rule,
 * so settings can move to another role without touching the others.
 */
export const manageSettings = Bouncer.ability((user: User) => {
  return user.role === 'admin'
})
