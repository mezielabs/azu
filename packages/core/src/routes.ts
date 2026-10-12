import type { HttpRouterService } from '@adonisjs/core/types'
import type { AdminInertiaMiddleware } from './middleware/admin_inertia_middleware.ts'
import type { AdminAccessMiddleware } from './middleware/admin_access_middleware.ts'
import type { AzuConfig } from './types.ts'

/**
 * Mounts the admin routes under `config.path`. Route names are prefixed
 * with `azu.` so they don't clash with the app's. Every route renders
 * through Azu's root view, then passes the access gate.
 */
export function registerRoutes(
  router: HttpRouterService,
  config: AzuConfig,
  middleware: { adminInertia: AdminInertiaMiddleware; access: AdminAccessMiddleware }
) {
  router
    .group(() => {
      router
        .get('/', ({ inertia }) => {
          return inertia.render('azu/dashboard', { azu: { path: config.path } })
        })
        .as('azu.dashboard')
    })
    .prefix(config.path)
    .use([
      (ctx, next) => middleware.adminInertia.handle(ctx, next),
      (ctx, next) => middleware.access.handle(ctx, next),
    ])
}
