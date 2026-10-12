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
