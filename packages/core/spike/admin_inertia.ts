/**
 * SPIKE (Phase 0, risk check 3). Throwaway.
 *
 * Shows how `/admin` gets its own Edge root view and Vite entry without
 * editing the app's `config/inertia.ts`. The app's Inertia middleware runs
 * first and creates `ctx.inertia` for its own root view; on admin routes we
 * replace it with an instance that renders `azu::admin`.
 */
import '@adonisjs/inertia/inertia_middleware'
import '@adonisjs/vite/vite_provider'
import app from '@adonisjs/core/services/app'
import { Inertia } from '@adonisjs/inertia'
import type { InertiaConfig } from '@adonisjs/inertia/types'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { HttpRouterService } from '@adonisjs/core/types'
import type { LucidModel } from '@adonisjs/lucid/types/model'
import type { JSONDataTypes } from '@adonisjs/core/types/transformers'

export const ADMIN_ENTRY = 'inertia/admin/app.tsx'

/**
 * Props for the package pages. Registered on `InertiaPages` so that
 * `ctx.inertia.render('azu/...')` is typed in core and in the app.
 */
export type SpikeResourceIndexProps = {
  resource: { name: string; label: string }
  columns: { name: string; kind: string; component?: string }[]
  rows: Record<string, JSONDataTypes>[]
}

declare module '@adonisjs/inertia/types' {
  interface InertiaPages {
    'azu/dashboard': { resources: { name: string; label: string }[] }
    'azu/resource/index': SpikeResourceIndexProps
  }
}

export class AdminInertiaMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const config = app.config.get<InertiaConfig>('inertia')
    const vite = await app.container.make('vite')
    ctx.inertia = new Inertia(ctx, { ...config, rootView: 'azu::admin' }, vite)
    return next()
  }
}

type SpikeResource = {
  model: LucidModel
  options: {
    label?: string
    query?: (query: any) => unknown
    columns?: { kind: string; name: string; meta?: Record<string, unknown> }[]
  }
}

function slug(model: LucidModel) {
  return model.table
}

export function registerSpikeRoutes(router: HttpRouterService, resources: SpikeResource[]) {
  const adminInertia = new AdminInertiaMiddleware()
  const list = resources.map((r) => ({
    name: slug(r.model),
    label: r.options.label ?? r.model.name,
  }))

  router
    .group(() => {
      router.get('/', ({ inertia }) => {
        return inertia.render('azu/dashboard', { resources: list }, { azuEntry: ADMIN_ENTRY })
      })

      router.get('/resources/:name', async ({ inertia, params, response }) => {
        const resource = resources.find((r) => slug(r.model) === params.name)
        if (!resource) return response.notFound()

        const query = resource.model.query()
        resource.options.query?.(query)
        const records = await query.limit(25)
        const columns = (resource.options.columns ?? []).map((c) => ({
          name: c.name,
          kind: c.kind,
          component: c.meta?.component as string | undefined,
        }))

        return inertia.render(
          'azu/resource/index',
          {
            resource: {
              name: slug(resource.model),
              label: resource.options.label ?? resource.model.name,
            },
            columns,
            rows: records.map((record) => record.serialize() as Record<string, JSONDataTypes>),
          },
          { azuEntry: ADMIN_ENTRY }
        )
      })
    })
    .prefix('/admin')
    .use((ctx, next) => adminInertia.handle(ctx, next))
}
