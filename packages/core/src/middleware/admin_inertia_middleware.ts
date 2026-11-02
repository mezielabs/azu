import '@adonisjs/inertia/inertia_middleware'
import { RuntimeException } from '@adonisjs/core/exceptions'
import { Inertia, InertiaManager } from '@adonisjs/inertia'
import type { InertiaConfig } from '@adonisjs/inertia/types'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { ApplicationService } from '@adonisjs/core/types'
import { runtimeSetupProblem } from '../setup/prerequisites.ts'

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
 * The app's shared props don't reach admin pages, and neither does its
 * server-side rendering: `ssr` is always off for admin pages.
 */
export class AdminInertiaMiddleware {
  constructor(protected app: ApplicationService) {}

  async handle(ctx: HttpContext, next: NextFn) {
    // An app without Inertia or Vite (the Hypermedia and API starter
    // kits) gets the steps to add them, not a TypeError (#64)
    const problem = runtimeSetupProblem({
      hasInertiaConfig: this.app.config.has('inertia'),
      hasInertiaProvider: this.app.container.hasBinding(InertiaManager),
      hasVite: this.app.container.hasBinding('vite'),
    })
    if (problem) throw new RuntimeException(problem, { code: 'E_AZU_SETUP' })

    const config = this.app.config.get<InertiaConfig>('inertia')
    const vite = await this.app.container.make('vite')
    ctx.inertia = new Inertia(
      ctx,
      {
        ...config,
        rootView: ADMIN_ROOT_VIEW,
        // The app's SSR bundle renders the app's pages, not Azu's: admin
        // pages always render in the browser
        ssr: { ...config.ssr, enabled: false },
      },
      vite
    )
    return next()
  }
}
