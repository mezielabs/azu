import type { HttpContext } from '@adonisjs/core/http'
import type { NavigationGroup } from '../schema.ts'
import type { Resource } from './define_resource.ts'

type PolicyBouncer = {
  with(policy: unknown): { allows(action: string, ...args: unknown[]): Promise<boolean> }
}

/**
 * Whether the user may list a resource: its policy's `viewList`. A
 * missing method, a missing policy, or no Bouncer at all means no.
 */
export async function canList(ctx: HttpContext, resource: Resource<any, any>): Promise<boolean> {
  const bouncer = (ctx as HttpContext & { bouncer?: PolicyBouncer }).bouncer
  if (!bouncer) return false
  try {
    return await bouncer.with(resource.options.policy).allows('viewList')
  } catch (error) {
    ctx.logger.warn(
      { err: error },
      `Azu hid "${resource.name}": its policy's viewList couldn't be checked`
    )
    return false
  }
}

/**
 * The navigation for this request: resources the user may list, in
 * groups. Ungrouped resources come first; groups and items are sorted
 * by label. FR-16 adds explicit ordering.
 */
export async function buildNavigation(
  ctx: HttpContext,
  resources: Resource<any, any>[],
  path: string
): Promise<NavigationGroup[]> {
  const visible = []
  for (const resource of resources) {
    if (await canList(ctx, resource)) visible.push(resource)
  }

  const groups = new Map<string | null, NavigationGroup>()
  for (const resource of visible.sort((a, b) => a.label.localeCompare(b.label))) {
    const label = resource.options.group ?? null
    if (!groups.has(label)) groups.set(label, { label, items: [] })
    groups.get(label)!.items.push({
      name: resource.name,
      label: resource.label,
      icon: resource.options.icon ?? null,
      href: `${path}/resources/${resource.name}`,
    })
  }

  return [...groups.values()].sort((a, b) =>
    a.label === null ? -1 : b.label === null ? 1 : a.label.localeCompare(b.label)
  )
}
