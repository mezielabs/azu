import type { HttpRouterService } from '@adonisjs/core/types'
import type { AdminInertiaMiddleware } from './middleware/admin_inertia_middleware.ts'
import type { AdminAccessMiddleware } from './middleware/admin_access_middleware.ts'
import type { AzuConfig } from './types.ts'
import type { Azu } from './azu.ts'
import { renderPage } from './render.ts'
import { canList } from './resources/navigation.ts'
import { listRecords } from './list/list_records.ts'
import { listStateUrl, parseListState } from './shared/list_state.ts'

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
       * The list screen (FR-05): server-side pagination, sorting and
       * search, all in the URL. The policy check runs on every request,
       * partial reloads included.
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
          const schema = resource.toSchema()
          const options = {
            defaultPerPage: config.perPage,
            sortable: schema.columns
              .filter((column) => column.sortable)
              .map((column) => column.name),
          }
          const state = parseListState(ctx.request.qs(), options)
          const { rows, meta } = await listRecords(resource, state)

          // Past the last page (say, after deleting rows): go to the last one
          if (state.page > meta.lastPage && meta.lastPage >= 1) {
            const path = `${config.path}/resources/${resource.name}`
            // withQs(false): apps can forward the query string on redirects by default
            return ctx.response
              .redirect()
              .withQs(false)
              .toPath(listStateUrl(path, { ...state, page: meta.lastPage }, options))
          }

          return renderPage(ctx, context, 'azu/resource/index', {
            resource: schema,
            list: { rows, meta, state, defaultPerPage: config.perPage },
          })
        })
        .as('azu.resources.index')
    })
    .prefix(config.path)
    .use([
      (ctx, next) => middleware.adminInertia.handle(ctx, next),
      (ctx, next) => middleware.access.handle(ctx, next),
    ])
}
