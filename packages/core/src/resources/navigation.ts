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
