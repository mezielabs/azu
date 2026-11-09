import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Asks search engines not to index the public demo (DEMO_MODE). A server
 * middleware, so it covers static files and 404s too. Static files are
 * written straight to Node's response, so the header goes there as well.
 */
export default class NoindexMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    ctx.response.response.setHeader('X-Robots-Tag', 'noindex, nofollow')
    ctx.response.header('X-Robots-Tag', 'noindex, nofollow')
    return next()
  }
}
