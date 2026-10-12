import { fsReadAll } from '@adonisjs/core/helpers'
import { RuntimeException } from '@adonisjs/core/exceptions'
import { Resource } from './define_resource.ts'

/**
 * Imports every resource file in `directory`. Each file must export a
 * resource as its default. A missing directory means no resources.
 */
export async function loadResources(directory: string): Promise<Resource<any, any>[]> {
  const files = await fsReadAll(directory, {
    pathType: 'url',
    ignoreMissingRoot: true,
    filter: (file) => /\.(ts|js|mts|mjs)$/.test(file) && !/\.d\.m?ts$/.test(file),
    sort: (current, next) => current.localeCompare(next),
  })

  const resources: Resource<any, any>[] = []
  for (const file of files) {
    const module = await import(file)
    if (!Resource.isResource(module.default)) {
      throw new RuntimeException(
        `"${file}" must export a resource as its default: export default defineResource(Model, { ... })`
      )
    }
    resources.push(module.default)
  }
  return resources
}
