import type { HttpContext } from '@adonisjs/core/http'
import type { AzuConfig, AzuUser } from '../types.ts'

/**
 * The parts of `ctx.auth` Azu reads, structurally: the app's guard
 * names and user model aren't known to Azu.
 */
type AuthContext = {
  auth?: {
    use(guard?: string): {
      user?: unknown
      logout?: () => Promise<void>
    }
  }
}

function text(user: Record<string, unknown>, attribute: string): string | null {
  const value = user[attribute]
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

/**
 * The signed-in user as the sidebar shows them: `fullName`, else `name`,
 * and `email`. Read from whatever the guard's user has, so it works with
 * the starter kits' User model and with apps that name things otherwise.
 * `null` for a guest.
 */
export function adminUser(ctx: HttpContext, config: Pick<AzuConfig, 'guard'>): AzuUser | null {
  const auth = (ctx as HttpContext & AuthContext).auth
  let user: unknown
  try {
    user = auth?.use(config.guard).user
  } catch {
    return null
  }
  if (typeof user !== 'object' || user === null) return null
  const attributes = user as Record<string, unknown>
  return {
    name: text(attributes, 'fullName') ?? text(attributes, 'name'),
    email: text(attributes, 'email'),
  }
}

/**
 * Signs the user out of the admin's guard and sends them to the app's
 * login page: `POST <path>/logout`, outside the access gate, so a user
 * who has lost access can still sign out. The guard's own `logout()`
 * clears the session and any remember-me token. A guard without one
 * (an API token guard) is left as it is.
 */
export async function logout(ctx: HttpContext, config: Pick<AzuConfig, 'guard' | 'loginUrl'>) {
  const guard = (ctx as HttpContext & AuthContext).auth?.use(config.guard)
  if (guard && typeof guard.logout === 'function') {
    await guard.logout()
  } else {
    ctx.logger.warn("Azu couldn't sign the user out: the admin's auth guard has no logout()")
  }
  // An Inertia visit must leave the admin app to load the app's login page
  if (ctx.request.header('x-inertia')) return ctx.inertia.location(config.loginUrl)
  return ctx.response.redirect(config.loginUrl)
}
