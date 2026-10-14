import type { HttpContext } from '@adonisjs/core/http'
import type { Resource } from './define_resource.ts'

type PolicyBouncer = {
  with(policy: unknown): { allows(action: string, ...args: unknown[]): Promise<boolean> }
}

/**
 * Whether the user passes a method on the resource's policy, e.g.
 * `allows(ctx, resource, 'update', product)`. Fails closed: a missing
 * method, a missing policy, or no Bouncer at all means no. A policy
 * that throws is logged and denied.
 */
export async function allows(
  ctx: HttpContext,
  resource: Resource<any, any>,
  ability: string,
  ...args: unknown[]
): Promise<boolean> {
  const bouncer = (ctx as HttpContext & { bouncer?: PolicyBouncer }).bouncer
  const policy = resource.options.policy as { prototype?: Record<string, unknown> } | undefined
  if (!bouncer || typeof policy?.prototype?.[ability] !== 'function') return false

  try {
    return await bouncer.with(policy).allows(ability, ...args)
  } catch (error) {
    ctx.logger.warn(
      { err: error },
      `Azu denied "${ability}" on "${resource.name}": its policy couldn't be checked`
    )
    return false
  }
}
