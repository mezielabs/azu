import { RuntimeException } from '@adonisjs/core/exceptions'
import { Resource } from './define_resource.ts'

/**
 * The resources mounted in the admin panel, by URL name.
 */
export class ResourceRegistry {
  #resources = new Map<string, Resource<any, any>>()

  /**
   * Registering the same resource twice is a no-op; two different
   * resources with the same URL name are an error.
   */
  register(...resources: Resource<any, any>[]): this {
    for (const resource of resources) {
      if (!Resource.isResource(resource)) {
        throw new RuntimeException('Azu can only register resources created with defineResource()')
      }
      const existing = this.#resources.get(resource.name)
      if (existing === resource) continue
      if (existing) {
        throw new RuntimeException(
          `Two admin resources are named "${resource.name}" (${existing.model.name} and ${resource.model.name})`
        )
      }
      this.#resources.set(resource.name, resource)
    }
    return this
  }

  get(name: string): Resource<any, any> | undefined {
    return this.#resources.get(name)
  }

  all(): Resource<any, any>[] {
    return [...this.#resources.values()]
  }
}
