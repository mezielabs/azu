import type { HttpContext } from '@adonisjs/core/http'
import type { AzuConfig, AzuPages } from './types.ts'
import type { Azu } from './azu.ts'
import { buildNavigation } from './resources/navigation.ts'

/**
 * Renders an Azu page with the shared `azu` props: the admin path and
 * this user's navigation. Pass `navigation: false` where the user isn't
 * allowed in at all.
 */
export async function renderPage<Page extends keyof AzuPages>(
  ctx: HttpContext,
  context: { config: AzuConfig; azu: Azu; navigation?: boolean },
  page: Page,
  props: Omit<AzuPages[Page], 'azu'>
) {
  const navigation =
    context.navigation === false
      ? []
      : await buildNavigation(ctx, context.azu.resources.all(), context.config.path)

  return ctx.inertia.render(page, {
    ...props,
    azu: { path: context.config.path, navigation },
  } as never)
}
