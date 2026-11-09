import { isValidRedirectUrl } from '@adonisjs/core/http/helpers'
import User from '#models/user'
import demo, { type DemoRole } from '#config/demo'
import { lastDemoReset } from '#services/demo_reset'
import { loginValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'

export default class SessionController {
  async create({ inertia }: HttpContext) {
    if (!demo.enabled) return inertia.render('auth/login', {})

    // The public demo (DEMO_MODE): one-click sign-in and the reset banner
    const resetAt = await lastDemoReset()
    return inertia.render('auth/login', {
      demo: {
        roles: Object.keys(demo.accounts) as DemoRole[],
        resetEveryMinutes: demo.resetEveryMinutes,
        lastResetAt: resetAt?.toISO() ?? null,
      },
    })
  }

  async store({ request, auth, response, session, inertia }: HttpContext) {
    const { email, password } = await request.validateUsing(loginValidator)
    const user = await User.verifyCredentials(email, password)

    await auth.use('web').login(user)
    const intended = session.pullIntendedUrl()
    if (typeof intended === 'string' && intended.startsWith('/') && isValidRedirectUrl(intended)) {
      // The admin has its own Inertia entry point, so load its page
      if (request.header('x-inertia')) return inertia.location(intended)
      return response.redirect(intended)
    }
    return response.redirect().toRoute('dashboard')
  }

  async destroy({ auth, response }: HttpContext) {
    await auth.use('web').logout()
    response.redirect().toRoute('session.create')
  }
}
