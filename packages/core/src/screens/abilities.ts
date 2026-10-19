import type { HttpContext } from '@adonisjs/core/http'
import type { ScreenAbility } from './define_screen.ts'

type AbilityBouncer = { allows(ability: ScreenAbility): Promise<boolean> }

/**
 * Whether the user passes a screen's or link's Bouncer ability
 * (FR-20, FR-21). No Bouncer, `false`, or an ability that throws means
 * no: it fails closed.
 */
export async function abilityAllows(ctx: HttpContext, ability: ScreenAbility): Promise<boolean> {
  const bouncer = (ctx as HttpContext & { bouncer?: AbilityBouncer }).bouncer
  if (!bouncer) return false
  try {
    return (await bouncer.allows(ability)) === true
  } catch (error) {
    ctx.logger.warn({ err: error }, "Azu denied a screen or link: its ability couldn't be checked")
    return false
  }
}
