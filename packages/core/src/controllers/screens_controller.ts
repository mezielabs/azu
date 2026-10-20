import type { HttpContext } from '@adonisjs/core/http'
import type { Azu } from '../azu.ts'
import { renderPage } from '../render.ts'
import { abilityAllows } from '../screens/abilities.ts'
import type { Screen } from '../screens/define_screen.ts'
import type { AzuConfig } from '../types.ts'

type Context = { config: AzuConfig; azu: Azu }

/**
 * Custom screens (FR-20) and the panel's home (FR-22). Each screen
 * checks its own ability on every request, inside the access gate.
 */
export class ScreensController {
  constructor(protected context: Context) {}

  /**
   * `<path>/screens/:screen`: the screen, a 404 when there's none by
   * that name, or the forbidden page (403) when its ability fails.
   */
  async show(ctx: HttpContext) {
    const screen = this.context.azu.screens.get(ctx.params.screen)
    if (!screen) {
      ctx.response.status(404)
      return renderPage(ctx, this.context, 'azu/errors/not_found', {})
    }
    if (!(await abilityAllows(ctx, screen.options.ability))) {
      ctx.response.status(403)
      return renderPage(ctx, this.context, 'azu/errors/forbidden', {})
    }
    return this.#render(ctx, ctx.params.screen, screen)
  }

  /**
   * `<path>/`: the `home` screen with the URL unchanged, a redirect to
   * the `home` resource's list, or the welcome page. A user who fails
   * the home screen's ability gets the welcome page, not a 403.
   */
  async home(ctx: HttpContext) {
    const { home, path } = this.context.config
    if (home && typeof home === 'object') {
      return ctx.response.redirect().withQs(false).toPath(`${path}/resources/${home.resource}`)
    }
    const screen = home ? this.context.azu.screens.get(home) : undefined
    if (home && screen && (await abilityAllows(ctx, screen.options.ability))) {
      return this.#render(ctx, home, screen)
    }
    return renderPage(ctx, this.context, 'azu/dashboard', {})
  }

  #render(ctx: HttpContext, name: string, screen: Screen<any>) {
    return renderPage(ctx, this.context, 'azu/screen', {
      screen: screen.toSchema(name),
      // Lazy: a partial reload of `data` computes it alone
      data: async () => (screen.options.data ? ((await screen.options.data(ctx)) ?? null) : null),
    } as never)
  }
}
