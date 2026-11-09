/*
|--------------------------------------------------------------------------
| Admin resources
|--------------------------------------------------------------------------
|
| Azu loads every resource in app/admin/resources automatically. To
| register resources here instead, set resources.autoload to false in
| config/azu.ts, then register each one:
|
|   import azu from '@mezielabs/azu/services/main'
|   import productResource from '#admin/resources/product_resource'
|
|   azu.register(productResource)
|
*/

import azu from '@mezielabs/azu/services/main'
import demo from '#config/demo'

/**
 * The public demo (DEMO_MODE) adds a Users resource, to show the roles
 * and the locked demo accounts. Otherwise the panel is unchanged.
 */
if (demo.enabled) {
  const { default: userResource } = await import('#admin/demo/user_resource')
  azu.register(userResource)
}
