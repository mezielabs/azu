import type { Resource } from './resources/define_resource.ts'
import { ResourceRegistry } from './resources/registry.ts'
import type { Screen } from './screens/define_screen.ts'
import { ScreenRegistry } from './screens/registry.ts'

/**
 * The Azu service, bound in the container as `azu`. Import it from
 * `@mezielabs/azu/services/main`.
 */
export class Azu {
  readonly resources = new ResourceRegistry()
  readonly screens = new ScreenRegistry()

  /**
   * Registers resources explicitly, from `start/azu.ts`. Use it when
   * `resources.autoload` is `false` in `config/azu.ts`.
   */
  register(...resources: Resource<any, any>[]): this {
    this.resources.register(...resources)
    return this
  }

  /**
   * Registers a custom screen under a name (FR-20), from
   * `start/azu.ts`. Use it when `screens.autoload` is `false` in
   * `config/azu.ts`; autoloaded screens are named after their file.
   *
   * @example
   * ```ts
   * azu.registerScreen('sales-report', salesReport)
   * ```
   */
  registerScreen(name: string, screen: Screen<any>): this {
    this.screens.register(name, screen)
    return this
  }
}

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    azu: Azu
  }
}
