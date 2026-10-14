import type { HttpRouterService } from '@adonisjs/core/types'
import type { AdminInertiaMiddleware } from './middleware/admin_inertia_middleware.ts'
import type { AdminAccessMiddleware } from './middleware/admin_access_middleware.ts'
import type { AzuConfig } from './types.ts'
import type { Azu } from './azu.ts'
import { renderPage } from './render.ts'
import { ResourcesController } from './controllers/resources_controller.ts'

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
  const resources = new ResourcesController(context)

  router
    .group(() => {
      router.get('/', (ctx) => renderPage(ctx, context, 'azu/dashboard', {})).as('azu.dashboard')

      router
        .group(() => {
          router.get('/', (ctx) => resources.index(ctx)).as('index')
          /**
           * Forms submit to their own URL, so a 422 that renders the form
           * again keeps the address bar on the form. Before `/:id`, so
           * "create" isn't read as an id.
           */
          router.get('/create', (ctx) => resources.create(ctx)).as('create')
          router.post('/create', (ctx) => resources.store(ctx)).as('store')
          // A belongsTo field's options, as JSON (FR-08)
          router.get('/fields/:field/options', (ctx) => resources.options(ctx)).as('fields.options')
          router.get('/:id', (ctx) => resources.show(ctx)).as('show')
          router.get('/:id/edit', (ctx) => resources.edit(ctx)).as('edit')
          router.put('/:id/edit', (ctx) => resources.update(ctx)).as('update')
        })
        .prefix('/resources/:resource')
        .as('azu.resources')
    })
    .prefix(config.path)
    .use([
      (ctx, next) => middleware.adminInertia.handle(ctx, next),
      (ctx, next) => middleware.access.handle(ctx, next),
    ])
}
