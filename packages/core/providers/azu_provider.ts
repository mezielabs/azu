import '../src/inertia_pages.ts'
import '@adonisjs/vite/vite_provider'
import type { ApplicationService } from '@adonisjs/core/types'
import { defineConfig } from '../src/define_config.ts'
import { registerRoutes } from '../src/routes.ts'
import { AdminInertiaMiddleware } from '../src/middleware/admin_inertia_middleware.ts'
import { AdminAccessMiddleware } from '../src/middleware/admin_access_middleware.ts'
import type { AzuConfig } from '../src/types.ts'
import { Azu } from '../src/azu.ts'
import { loadResources } from '../src/resources/loader.ts'

/**
 * Registers Azu with the host application: mounts the package's Edge
 * views under the `azu` disk, binds the `azu` service with its resource
 * registry, and mounts the admin routes under `config.path`, behind the
 * access gate.
 */
export default class AzuProvider {
  constructor(protected app: ApplicationService) {}

  /**
   * `config/admin.ts` is optional; without it Azu uses the defaults.
   */
  protected getConfig(): AzuConfig {
    return this.app.config.get<AzuConfig>('admin', defineConfig())
  }

  register() {
    this.app.container.singleton('azu', () => new Azu())
  }

  async boot() {
    const { default: edge } = await import('edge.js')
    edge.mount('azu', new URL('../resources/views', import.meta.url))
    edge.global('azu', { entry: this.getConfig().entry })
  }

  /**
   * Autoloads resources from `resources.autoload`, then mounts the
   * routes. Resources registered in `start/admin.ts` join the same
   * registry.
   */
  async start() {
    const router = await this.app.container.make('router')
    const azu = await this.app.container.make('azu')
    const config = this.getConfig()

    if (config.resources.autoload) {
      azu.register(...(await loadResources(this.app.makePath(config.resources.autoload))))
    }

    registerRoutes(router, config, azu, {
      adminInertia: new AdminInertiaMiddleware(this.app),
      access: new AdminAccessMiddleware(config),
    })
  }
}
