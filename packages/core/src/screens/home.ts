import { RuntimeException } from '@adonisjs/core/exceptions'
import type { Azu } from '../azu.ts'
import type { AzuConfig } from '../types.ts'

/**
 * `home` in config/azu.ts must name a registered screen or resource
 * (FR-22). Checked once the app has started, after `start/azu.ts` has
 * registered its screens and resources.
 */
export function assertHome(config: Pick<AzuConfig, 'home'>, azu: Azu) {
  const { home } = config
  if (home === null) return
  if (typeof home === 'string') {
    if (azu.screens.has(home)) return
    const names = azu.screens.all().map((entry) => entry.name)
    throw new RuntimeException(
      `"home" in config/azu.ts is "${home}", but no screen has that name` +
        (names.length > 0
          ? ` (screens: ${names.join(', ')})`
          : '. Screens live in app/admin/screens')
    )
  }
  if (!azu.resources.get(home.resource)) {
    throw new RuntimeException(
      `"home" in config/azu.ts is { resource: "${home.resource}" }, but no resource has that name`
    )
  }
}
