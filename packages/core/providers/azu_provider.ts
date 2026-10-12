import '../src/inertia_pages.ts'
import '@adonisjs/vite/vite_provider'
import type { ApplicationService } from '@adonisjs/core/types'
import { defineConfig } from '../src/define_config.ts'
import { registerRoutes } from '../src/routes.ts'
import { AdminInertiaMiddleware } from '../src/middleware/admin_inertia_middleware.ts'
import { AdminAccessMiddleware } from '../src/middleware/admin_access_middleware.ts'
import type { AzuConfig } from '../src/types.ts'

/**
 * Registers Azu with the host application: mounts the package's Edge
 * views under the `azu` disk and the admin routes under `config.path`,
 * behind the access gate.
 */
export default class AzuProvider {
  constructor(protected app: ApplicationService) {}

  /**
   * `config/admin.ts` is optional; without it Azu uses the defaults.
   */
  protected getConfig(): AzuConfig {
    return this.app.config.get<AzuConfig>('admin', defineConfig())
  }

  async boot() {
    const { default: edge } = await import('edge.js')
    edge.mount('azu', new URL('../resources/views', import.meta.url))
    edge.global('azu', { entry: this.getConfig().entry })
  }

  async start() {
    const router = await this.app.container.make('router')
    const config = this.getConfig()
    registerRoutes(router, config, {
      adminInertia: new AdminInertiaMiddleware(this.app),
      access: new AdminAccessMiddleware(config),
    })
  }
}
