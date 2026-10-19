import app from '@adonisjs/core/services/app'
import type { Azu } from '../src/azu.ts'

let azu: Azu

/**
 * The Azu service, for `start/azu.ts`:
 *
 * @example
 * ```ts
 * import azu from '@mezielabs/azu/services/main'
 * import productResource from '#admin/resources/product_resource'
 *
 * azu.register(productResource)
 * ```
 */
await app.booted(async () => {
  azu = await app.container.make('azu')
})

export { azu as default }
