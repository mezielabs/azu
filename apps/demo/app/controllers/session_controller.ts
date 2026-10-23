import { isValidRedirectUrl } from '@adonisjs/core/http/helpers'
import User from '#models/user'
import { loginValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'

export default class SessionController {
  async create({ inertia }: HttpContext) {
    return inertia.render('auth/login', {})
  }

  async store({ request, auth, response, session, inertia }: HttpContext) {
    const { email, password } = await request.validateUsing(loginValidator)
    const user = await User.verifyCredentials(email, password)

    await auth.use('web').login(user)
    const intended = session.pullIntendedUrl()
    if (typeof intended === 'string' && intended.startsWith('/') && isValidRedirectUrl(intended)) {
      // Admin has its own Inertia entry point, so load its document.
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
