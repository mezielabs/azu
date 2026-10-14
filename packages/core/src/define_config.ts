import type { AzuConfig, AzuConfigInput } from './types.ts'
import { isPageSize } from './shared/list_state.ts'

/**
 * Default URL prefix and admin Vite entry.
 */
export const defaults: Omit<AzuConfig, 'timezone'> = {
  path: '/admin',
  entry: 'inertia/admin/app.tsx',
  loginUrl: '/login',
  resources: { autoload: 'app/admin/resources' },
  perPage: 25,
}

/**
 * The server process's timezone, from `TZ`.
 */
export function processTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

function isTimezone(name: string) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: name })
    return true
  } catch {
    return false
  }
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
  if (config.timezone !== undefined && !isTimezone(config.timezone)) {
    throw new Error(
      `"timezone" in config/admin.ts must be an IANA timezone such as "Africa/Lagos", not "${config.timezone}"`
    )
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
    timezone: config.timezone ?? processTimezone(),
    resources: {
      autoload:
        config.resources?.autoload === undefined
          ? defaults.resources.autoload
          : config.resources.autoload,
    },
  }
}
