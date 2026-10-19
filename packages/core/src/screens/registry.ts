import { RuntimeException } from '@adonisjs/core/exceptions'
import { Screen } from './define_screen.ts'

/** Screen names: the file name in kebab case, as in their URL */
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * The custom screens mounted in the admin panel, by name (FR-20).
 */
export class ScreenRegistry {
  #screens = new Map<string, Screen<any>>()

  /**
   * Registering the same screen under its name again is a no-op; two
   * screens with one name are a boot error.
   */
  register(name: string, screen: Screen<any>): this {
    if (!Screen.isScreen(screen)) {
      throw new RuntimeException('Azu can only register screens created with defineScreen()')
    }
    if (!NAME.test(name)) {
      throw new RuntimeException(
        `"${name}" can't name a screen: use lowercase letters, digits and dashes, like sales-report`
      )
    }
    const existing = this.#screens.get(name)
    if (existing === screen) return this
    if (existing) {
      throw new RuntimeException(
        `Two admin screens are named "${name}" ("${existing.options.label}" and "${screen.options.label}")`
      )
    }
    this.#screens.set(name, screen)
    return this
  }

  get(name: string): Screen<any> | undefined {
    return this.#screens.get(name)
  }

  has(name: string): boolean {
    return this.#screens.has(name)
  }

  all(): { name: string; screen: Screen<any> }[] {
    return [...this.#screens].map(([name, screen]) => ({ name, screen }))
  }
}
