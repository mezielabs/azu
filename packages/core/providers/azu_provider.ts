import type { ApplicationService } from '@adonisjs/core/types'

/**
 * Registers Azu with the host application.
 *
 * Phase 0: only mounts the package's Edge views under the `azu` disk, so
 * `azu::admin` resolves to `build/resources/views/admin.edge`.
 */
export default class AzuProvider {
  constructor(protected app: ApplicationService) {}

  async boot() {
    const { default: edge } = await import('edge.js')
    edge.mount('azu', new URL('../resources/views', import.meta.url))
  }
}
