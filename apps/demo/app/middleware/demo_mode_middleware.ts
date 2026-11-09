import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import demo from '#config/demo'
import { throttleWrites } from '#start/limiter'
import { lastDemoReset } from '#services/demo_reset'

/**
 * The cookie the admin panel's demo banner reads
 * (inertia/admin/demo_banner.tsx): "<minutes between resets>|<last reset,
 * ISO 8601, or empty>". Admin pages don't get the app's shared props, so
 * the banner can't read them.
 */
export const DEMO_COOKIE = 'azu_demo'

/**
 * The public demo's request rules (DEMO_MODE): limits write requests
 * per IP address, and tells the banner when the demo last reset.
 * start/kernel.ts registers it only with DEMO_MODE on.
 */
export default class DemoModeMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const resetAt = await lastDemoReset()
    ctx.response.plainCookie(DEMO_COOKIE, `${demo.resetEveryMinutes}|${resetAt?.toISO() ?? ''}`, {
      encode: false,
      httpOnly: false,
      maxAge: undefined,
    })
    return throttleWrites(ctx, next)
  }
}
