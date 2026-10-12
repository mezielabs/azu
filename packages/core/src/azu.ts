import type { Resource } from './resources/define_resource.ts'
import { ResourceRegistry } from './resources/registry.ts'

/**
 * The Azu service, bound in the container as `azu`. Import it from
 * `@mezielabs/azu/services/main`.
 */
export class Azu {
  readonly resources = new ResourceRegistry()

  /**
   * Registers resources explicitly, from `start/admin.ts`. Use it when
   * `resources.autoload` is `false` in `config/admin.ts`.
   */
  register(...resources: Resource<any, any>[]): this {
    this.resources.register(...resources)
    return this
  }
}

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    azu: Azu
  }
}
