import type { HttpContext } from '@adonisjs/core/http'
import type { NavigationGroup } from '../schema.ts'
import type { Resource } from './define_resource.ts'
import { allows } from './abilities.ts'

/**
 * Whether the user may list a resource: its policy's `viewList`. A
 * missing method, a missing policy, or no Bouncer at all means no.
 */
export function canList(ctx: HttpContext, resource: Resource<any, any>): Promise<boolean> {
  return allows(ctx, resource, 'viewList')
}

/**
 * Lower `order` first; resources without one after, then by label.
 */
function byOrder(a: Resource<any, any>, b: Resource<any, any>) {
  const [x, y] = [a.options.order ?? Infinity, b.options.order ?? Infinity]
  return x === y ? a.label.localeCompare(b.label) : x - y
}

/**
 * The navigation for this request: resources the user may list, in
 * groups (FR-16).
 *
 * - Ungrouped resources come first.
 * - Groups follow in the order of `navigation.groups` in
 *   config/azu.ts, then any others by label.
 * - Within a group, resources follow their `order`, then their label.
 */
export async function buildNavigation(
  ctx: HttpContext,
  resources: Resource<any, any>[],
  path: string,
  options: { groups?: string[] } = {}
): Promise<NavigationGroup[]> {
  const visible = []
  for (const resource of resources) {
    if (await canList(ctx, resource)) visible.push(resource)
  }

  const groups = new Map<string | null, NavigationGroup>()
  for (const resource of visible.sort(byOrder)) {
    const label = resource.options.group ?? null
    if (!groups.has(label)) groups.set(label, { label, items: [] })
    groups.get(label)!.items.push({
      name: resource.name,
      label: resource.label,
      icon: resource.options.icon ?? null,
      href: `${path}/resources/${resource.name}`,
    })
  }

  const position = (label: string) => {
    const index = (options.groups ?? []).indexOf(label)
    return index === -1 ? Infinity : index
  }
  return [...groups.values()].sort((a, b) => {
    if (a.label === null) return -1
    if (b.label === null) return 1
    const [x, y] = [position(a.label), position(b.label)]
    return x === y ? a.label.localeCompare(b.label) : x - y
  })
}
