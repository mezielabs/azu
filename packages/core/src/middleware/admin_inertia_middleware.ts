import '@adonisjs/inertia/inertia_middleware'
import { Inertia } from '@adonisjs/inertia'
import type { InertiaConfig } from '@adonisjs/inertia/types'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { ApplicationService } from '@adonisjs/core/types'

/**
 * The Edge view admin pages render into. The provider mounts the
 * package's views under the `azu` disk.
 */
export const ADMIN_ROOT_VIEW = 'azu::admin'

/**
 * Gives admin routes their own Inertia root view and Vite entry.
 *
 * `@adonisjs/inertia` has one `rootView` for the whole app, and the app's
 * Inertia middleware has already created `ctx.inertia` by the time admin
 * routes run. This middleware replaces it with an instance that renders
 * `azu::admin`, without editing the app's `config/inertia.ts` or layout.
 * The app's shared props don't reach admin pages.
 */
export class AdminInertiaMiddleware {
  constructor(protected app: ApplicationService) {}

  async handle(ctx: HttpContext, next: NextFn) {
    const config = this.app.config.get<InertiaConfig>('inertia')
    const vite = await this.app.container.make('vite')
    ctx.inertia = new Inertia(ctx, { ...config, rootView: ADMIN_ROOT_VIEW }, vite)
    return next()
  }
}
