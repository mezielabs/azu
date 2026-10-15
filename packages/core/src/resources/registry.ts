import { RuntimeException } from '@adonisjs/core/exceptions'
import { Resource } from './define_resource.ts'

/**
 * The resources mounted in the admin panel, by URL name.
 */
export class ResourceRegistry {
  #resources = new Map<string, Resource<any, any>>()

  /**
   * Registering the same resource twice is a no-op; two different
   * resources with the same URL name are an error. So are an action
   * named `delete` and clashing filter names, checked here so they fail
   * at boot.
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
      resource.actions()
      resource.filters()
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

  /**
   * The first resource for a model, e.g. to link a related record.
   */
  forModel(model: unknown): Resource<any, any> | undefined {
    return this.all().find((resource) => resource.model === model)
  }
}
