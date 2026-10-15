import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { AzuConfig } from '../types.ts'

/**
 * The Bouncer ability that decides who can open the admin panel.
 */
export const ACCESS_ABILITY = 'accessAdmin'

/**
 * What the gate needs from the app's auth and Bouncer setup. Read
 * structurally: `ctx.bouncer` is typed by the app's own generated
 * middleware, and the app's guard names aren't known to Azu.
 */
type AccessContext = {
  auth?: { use(guard?: string): { check(): Promise<boolean> } }
  bouncer?: { allows(ability: string): Promise<boolean> }
}

/**
 * The access gate for every admin route (FR-02).
 *
 * - Guests are sent to `config.loginUrl`: a 302, or for Inertia visits a
 *   409 location response, so the browser loads the app's login page
 *   rather than trying to render it inside the admin app.
 * - Signed-in users must pass the app's `accessAdmin` Bouncer ability,
 *   or they get a 403 and the `azu/errors/forbidden` page.
 *
 * It fails closed: without auth, without Bouncer, or without an
 * `accessAdmin` ability, everyone is denied, and the reason is logged
 * for the developer rather than shown to the user.
 */
export class AdminAccessMiddleware {
  constructor(protected config: AzuConfig) {}

  async handle(ctx: HttpContext, next: NextFn) {
    const { auth, bouncer } = ctx as HttpContext & AccessContext

    if (!auth) {
      ctx.logger.warn('Azu denied admin access: @adonisjs/auth is not set up for this request')
      return this.forbid(ctx)
    }

    if (!(await auth.use(this.config.guard).check())) {
      if (ctx.request.header('x-inertia')) {
        return ctx.inertia.location(this.config.loginUrl)
      }
      return ctx.response.redirect(this.config.loginUrl)
    }

    if (!bouncer) {
      ctx.logger.warn(
        'Azu denied admin access: Bouncer is not set up. Run "node ace add @adonisjs/bouncer"'
      )
      return this.forbid(ctx)
    }

    let allowed = false
    try {
      allowed = await bouncer.allows(ACCESS_ABILITY)
    } catch (error) {
      ctx.logger.warn(
        { err: error },
        `Azu denied admin access: the "${ACCESS_ABILITY}" ability couldn't be checked. Export it from app/abilities/main.ts`
      )
    }

    if (!allowed) return this.forbid(ctx)
    return next()
  }

  /**
   * Middleware return values aren't sent, so send the page explicitly:
   * HTML on a full page load, the page object on an Inertia visit.
   */
  protected async forbid(ctx: HttpContext) {
    const page = await ctx.inertia.render('azu/errors/forbidden', {
      azu: {
        path: this.config.path,
        navigation: [],
        timezone: this.config.timezone,
        brand: { name: this.config.brand.name, logo: this.config.brand.logo },
      },
    })
    ctx.response.status(403).send(page)
  }
}
