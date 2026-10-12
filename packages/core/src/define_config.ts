import type { AzuConfig, AzuConfigInput } from './types.ts'

/**
 * Default URL prefix and admin Vite entry.
 */
export const defaults: AzuConfig = {
  path: '/admin',
  entry: 'inertia/admin/app.tsx',
}

/**
 * Defines Azu's configuration in `config/admin.ts`.
 *
 * @example
 * ```ts
 * import { defineConfig } from '@mezielabs/azu'
 *
 * export default defineConfig({ path: '/admin' })
 * ```
 */
export function defineConfig(config: AzuConfigInput = {}): AzuConfig {
  const path = `/${(config.path ?? defaults.path).replace(/^\/+|\/+$/g, '')}`
  if (path === '/') {
    throw new Error('Azu can\'t be mounted at "/". Set "path" in config/admin.ts, e.g. "/admin"')
  }
  return { path, entry: config.entry ?? defaults.entry }
}
