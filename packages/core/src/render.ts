import type { HttpContext } from '@adonisjs/core/http'
import type { AzuConfig, AzuPages } from './types.ts'
import type { Azu } from './azu.ts'
import { buildNavigation } from './resources/navigation.ts'
import { adminUser } from './auth/admin_user.ts'
import { abilityAllows } from './screens/abilities.ts'

/**
 * Renders an Azu page with the shared `azu` props: the admin path, the
 * brand, the signed-in user and this user's navigation. Pass `navigation: false` where the user isn't
 * allowed in at all.
 */
export async function renderPage<Page extends keyof AzuPages>(
  ctx: HttpContext,
  context: { config: AzuConfig; azu: Azu; navigation?: boolean },
  page: Page,
  props: Omit<AzuPages[Page], 'azu'>
) {
  return ctx.inertia.render(page, {
    ...props,
    /**
     * Lazy, so partial reloads that don't ask for `azu` (paging,
     * sorting, searching) skip the per-resource policy checks
     */
    azu: async () => ({
      home: await homeScreen(ctx, context),
      path: context.config.path,
      timezone: context.config.timezone,
      brand: { name: context.config.brand.name, logo: context.config.brand.logo },
      user: adminUser(ctx, context.config),
      siteUrl: context.config.siteUrl || null,
      navigation:
        context.navigation === false
          ? []
          : await buildNavigation(ctx, context.azu.resources.all(), context.config.path, {
              groups: context.config.navigation.groups,
              screens: context.azu.screens.all(),
              links: context.config.navigation.links,
              home: typeof context.config.home === 'string' ? context.config.home : null,
            }),
    }),
  } as never)
}

/**
 * The home screen (FR-22), when `home` names one and the user passes
 * its ability: the navigation's first link shows its label and icon.
 */
async function homeScreen(ctx: HttpContext, context: { config: AzuConfig; azu: Azu }) {
  const name = context.config.home
  if (typeof name !== 'string') return null
  const screen = context.azu.screens.get(name)
  if (!screen || !(await abilityAllows(ctx, screen.options.ability))) return null
  return { name, label: screen.options.label, icon: screen.options.icon ?? null }
}
