import type { HttpRouterService } from '@adonisjs/core/types'
import type { AdminInertiaMiddleware } from './middleware/admin_inertia_middleware.ts'
import type { AdminAccessMiddleware } from './middleware/admin_access_middleware.ts'
import type { AzuConfig } from './types.ts'
import type { Azu } from './azu.ts'
import { logout } from './auth/admin_user.ts'
import { ResourcesController } from './controllers/resources_controller.ts'
import { ScreensController } from './controllers/screens_controller.ts'

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
  const screens = new ScreensController(context)

  router
    .group(() => {
      // The home screen, a resource's list, or the welcome page (FR-22)
      router.get('/', (ctx) => screens.home(ctx)).as('azu.dashboard')
      // Custom screens (FR-20), under /screens/ so the panel's own routes have room
      router.get('/screens/:screen', (ctx) => screens.show(ctx)).as('azu.screens.show')
      // A form screen submits to its own URL (FR-23)
      router.put('/screens/:screen', (ctx) => screens.update(ctx)).as('azu.screens.update')

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
          // Row and bulk actions, as JSON (FR-12)
          router.post('/actions/:kind/:action', (ctx) => resources.action(ctx)).as('actions.run')
          // A belongsTo field's options, as JSON (FR-08)
          router.get('/fields/:field/options', (ctx) => resources.options(ctx)).as('fields.options')
          // A belongsTo filter's options, as JSON (FR-13)
          router
            .get('/filters/:filter/options', (ctx) => resources.filterOptions(ctx))
            .as('filters.options')
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

  /**
   * Sign out, from the sidebar. Outside the access gate: a user who has
   * lost access can still sign out. Shield's CSRF check applies, as for
   * any POST.
   */
  router
    .post(`${config.path}/logout`, (ctx) => logout(ctx, config))
    .as('azu.logout')
    .use((ctx, next) => middleware.adminInertia.handle(ctx, next))
}
