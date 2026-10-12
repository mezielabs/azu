import type { HttpRouterService } from '@adonisjs/core/types'
import type { AdminInertiaMiddleware } from './middleware/admin_inertia_middleware.ts'
import type { AdminAccessMiddleware } from './middleware/admin_access_middleware.ts'
import type { AzuConfig } from './types.ts'
import type { Azu } from './azu.ts'
import { renderPage } from './render.ts'
import { canList } from './resources/navigation.ts'

/**
 * Mounts the admin routes under `config.path`. Route names are prefixed
 * with `azu.` so they don't clash with the app's. Every route renders
 * through Azu's root view, then passes the access gate.
 */
export function registerRoutes(
  router: HttpRouterService,
  config: AzuConfig,
  azu: Azu,
  middleware: { adminInertia: AdminInertiaMiddleware; access: AdminAccessMiddleware }
) {
  const context = { config, azu }

  router
    .group(() => {
      router.get('/', (ctx) => renderPage(ctx, context, 'azu/dashboard', {})).as('azu.dashboard')

      /**
       * The list screen arrives with FR-05; FR-03 renders a placeholder.
       * The policy check is real: the server always checks.
       */
      router
        .get('/resources/:resource', async (ctx) => {
          const resource = azu.resources.get(ctx.params.resource)
          if (!resource) {
            ctx.response.status(404)
            return renderPage(ctx, context, 'azu/errors/not_found', {})
          }
          if (!(await canList(ctx, resource))) {
            ctx.response.status(403)
            return renderPage(ctx, context, 'azu/errors/forbidden', {})
          }
          return renderPage(ctx, context, 'azu/resource/index', { resource: resource.toSchema() })
        })
        .as('azu.resources.index')
    })
    .prefix(config.path)
    .use([
      (ctx, next) => middleware.adminInertia.handle(ctx, next),
      (ctx, next) => middleware.access.handle(ctx, next),
    ])
}
