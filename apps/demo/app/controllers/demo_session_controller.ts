import app from '@adonisjs/core/services/app'
import type { HttpContext } from '@adonisjs/core/http'
import type { AzuConfig } from '@mezielabs/azu/types'
import User from '#models/user'
import demo, { type DemoRole } from '#config/demo'

/**
 * The public demo's own routes (DEMO_MODE): "Sign in as Admin / Editor /
 * Viewer" on the login page, and `/`. start/routes.ts registers them only
 * with DEMO_MODE on.
 */
export default class DemoSessionController {
  /**
   * `/`: the panel for a signed-in visitor, the login page otherwise, so
   * "Try the demo" never lands on the starter kit's welcome page
   */
  async home(ctx: HttpContext) {
    if (!ctx.auth.isAuthenticated) return ctx.response.redirect().toRoute('session.create')
    return this.#openAdmin(ctx)
  }

  async store({ params, request, response, auth, session, inertia }: HttpContext) {
    const role = params.role as string
    if (!Object.hasOwn(demo.accounts, role)) return response.notFound()

    const user = await User.findBy('email', demo.accounts[role as DemoRole])
    if (!user) {
      // Mid-reset: the seeders haven't recreated the account yet
      session.flash('error', 'The demo is resetting. Try again in a minute.')
      return response.redirect().back()
    }

    await auth.use('web').login(user)
    return this.#openAdmin({ request, response, inertia })
  }

  #openAdmin({
    request,
    response,
    inertia,
  }: Pick<HttpContext, 'request' | 'response' | 'inertia'>) {
    const admin = app.config.get<AzuConfig>('azu').path
    // The admin has its own Inertia entry point, so load its page
    if (request.header('x-inertia')) return inertia.location(admin)
    return response.redirect(admin)
  }
}
