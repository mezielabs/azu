import type { AzuConfig, AzuConfigInput } from './types.ts'
import { isPageSize } from './shared/list_state.ts'
import { isHexColor } from './theme/color.ts'

/**
 * Default URL prefix and admin Vite entry.
 */
export const defaults: Omit<AzuConfig, 'timezone' | 'defaultDisk'> = {
  path: '/admin',
  entry: 'inertia/admin/app.tsx',
  loginUrl: '/login',
  siteUrl: '/',
  resources: { autoload: 'app/admin/resources' },
  perPage: 25,
  brand: { name: 'Admin', logo: null, color: '#2563eb' },
  navigation: { groups: [] },
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
  if (config.brand?.color !== undefined && !isHexColor(config.brand.color)) {
    throw new Error(
      `"brand.color" in config/admin.ts must be a hex colour such as "#2563eb", not "${config.brand.color}"`
    )
  }
  if (
    config.siteUrl !== undefined &&
    config.siteUrl !== false &&
    (typeof config.siteUrl !== 'string' || config.siteUrl.trim() === '')
  ) {
    throw new Error('"siteUrl" in config/admin.ts must be a path or URL such as "/", or false')
  }
  const groups = config.navigation?.groups ?? []
  if (!Array.isArray(groups) || !groups.every((group) => typeof group === 'string')) {
    throw new Error('"navigation.groups" in config/admin.ts must be a list of group labels')
  }
  const path = `/${(config.path ?? defaults.path).replace(/^\/+|\/+$/g, '')}`
  if (path === '/') {
    throw new Error('Azu can\'t be mounted at "/". Set "path" in config/admin.ts, e.g. "/admin"')
  }
  return {
    path,
    entry: config.entry ?? defaults.entry,
    guard: config.guard,
    defaultDisk: config.defaultDisk,
    loginUrl: config.loginUrl ?? defaults.loginUrl,
    siteUrl: config.siteUrl === undefined ? defaults.siteUrl : config.siteUrl,
    perPage: config.perPage ?? defaults.perPage,
    timezone: config.timezone ?? processTimezone(),
    navigation: { groups: [...groups] },
    brand: {
      name: config.brand?.name?.trim() || defaults.brand.name,
      logo: config.brand?.logo || null,
      color: config.brand?.color?.trim() ?? defaults.brand.color,
    },
    resources: {
      autoload:
        config.resources?.autoload === undefined
          ? defaults.resources.autoload
          : config.resources.autoload,
    },
  }
}
