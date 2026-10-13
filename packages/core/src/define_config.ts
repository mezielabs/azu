import type { AzuConfig, AzuConfigInput } from './types.ts'
import { isPageSize } from './shared/list_state.ts'

/**
 * Default URL prefix and admin Vite entry.
 */
export const defaults: AzuConfig = {
  path: '/admin',
  entry: 'inertia/admin/app.tsx',
  loginUrl: '/login',
  resources: { autoload: 'app/admin/resources' },
  perPage: 25,
}

/**
 * Defines Azu's configuration in `config/admin.ts`.
 *
 * @example
 * ```ts
 * import { defineConfig } from '@mezielabs/azu'
 *
 * export default defineConfig({ path: '/admin', guard: 'web', loginUrl: '/login' })
 * ```
 */
export function defineConfig(config: AzuConfigInput = {}): AzuConfig {
  if (config.perPage !== undefined && !isPageSize(config.perPage)) {
    throw new Error(`"perPage" in config/admin.ts must be 10, 25, 50 or 100, not ${config.perPage}`)
  }
  const path = `/${(config.path ?? defaults.path).replace(/^\/+|\/+$/g, '')}`
  if (path === '/') {
    throw new Error('Azu can\'t be mounted at "/". Set "path" in config/admin.ts, e.g. "/admin"')
  }
  return {
    path,
    entry: config.entry ?? defaults.entry,
    guard: config.guard,
    loginUrl: config.loginUrl ?? defaults.loginUrl,
    perPage: config.perPage ?? defaults.perPage,
    resources: {
      autoload:
        config.resources?.autoload === undefined
          ? defaults.resources.autoload
          : config.resources.autoload,
    },
  }
}
