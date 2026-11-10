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
import { policies } from '#generated/policies'

/**
 * Who can open the admin panel. Azu's installer will add this ability
 * returning `false`; the demo lets admins, staff and viewers in.
 */
// #region access-admin
export const accessAdmin = Bouncer.ability((user: User) => {
  return user.role === 'admin' || user.role === 'staff' || user.role === 'viewer'
})
// #endregion

/**
 * Who can see the Reports screens (FR-20): admins, not staff.
 */
// #region view-reports
export const viewReports = Bouncer.ability((user: User) => {
  return user.role === 'admin'
})
// #endregion

/**
 * Who sees the "Awaiting shipping" link (FR-21): whoever OrderPolicy
 * lets list orders. It asks the policy rather than restating its rule,
 * through Bouncer, so the policy's before and after hooks apply too. The
 * policy comes from the app's lazy registry, as in the Bouncer
 * middleware, so this file loads without importing it. It only hides
 * the link; OrderPolicy still guards the list it opens.
 */
// #region view-orders
export const viewOrders = Bouncer.ability((user: User) => {
  return new Bouncer(user, {}, policies).with('OrderPolicy').allows('viewList')
})
// #endregion

/**
 * Who can change the store's settings (FR-23): admins. Its own rule,
 * so settings can move to another role without touching the others.
 */
// #region manage-settings
export const manageSettings = Bouncer.ability((user: User) => {
  return user.role === 'admin'
})
// #endregion
