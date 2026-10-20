import type { HttpContext } from '@adonisjs/core/http'
import type { NavigationGroup, NavigationItem } from '../schema.ts'
import type { NavigationLinkInput } from '../types.ts'
import { abilityAllows } from '../screens/abilities.ts'
import type { Screen } from '../screens/define_screen.ts'
import type { Resource } from './define_resource.ts'
import { allows } from './abilities.ts'

/**
 * Whether the user may list a resource: its policy's `viewList`. A
 * missing method, a missing policy, or no Bouncer at all means no.
 */
export function canList(ctx: HttpContext, resource: Resource<any, any>): Promise<boolean> {
  return allows(ctx, resource, 'viewList')
}

type Entry = {
  group: string | null
  order: number | undefined
  item: NavigationItem
}

/**
 * Lower `order` first; items without one after, then by label. Resources,
 * screens and links sort together within their group.
 */
function byOrder(a: Entry, b: Entry) {
  const [x, y] = [a.order ?? Infinity, b.order ?? Infinity]
  return x === y ? a.item.label.localeCompare(b.item.label) : x - y
}

/** An absolute `http(s)` URL: it opens in a new tab */
export function isExternalUrl(url: string): boolean {
  return /^https?:\/\//i.test(url)
}

/**
 * The navigation for this request (FR-16, FR-20, FR-21): the resources
 * the user may list, the screens whose ability they pass, and the
 * configured links they may see, in groups.
 *
 * - Ungrouped items come first.
 * - Groups follow in the order of `navigation.groups` in
 *   config/azu.ts, then any others by label.
 * - Within a group, items follow their `order`, then their label.
 */
export async function buildNavigation(
  ctx: HttpContext,
  resources: Resource<any, any>[],
  path: string,
  options: {
    groups?: string[]
    screens?: { name: string; screen: Screen<any> }[]
    links?: NavigationLinkInput[]
    /** The home screen's name: it's the navigation's first link, so not listed again */
    home?: string | null
  } = {}
): Promise<NavigationGroup[]> {
  const entries: Entry[] = []
  for (const resource of resources) {
    if (!(await canList(ctx, resource))) continue
    entries.push({
      group: resource.options.group ?? null,
      order: resource.options.order,
      item: {
        kind: 'resource',
        name: resource.name,
        label: resource.label,
        icon: resource.options.icon ?? null,
        href: `${path}/resources/${resource.name}`,
        external: false,
      },
    })
  }
  for (const { name, screen } of options.screens ?? []) {
    if (name === options.home) continue
    if (!(await abilityAllows(ctx, screen.options.ability))) continue
    entries.push({
      group: screen.options.group ?? null,
      order: screen.options.order,
      item: {
        kind: 'screen',
        name,
        label: screen.options.label,
        icon: screen.options.icon ?? null,
        href: `${path}/screens/${name}`,
        external: false,
      },
    })
  }
  for (const [index, link] of (options.links ?? []).entries()) {
    // Hides the link only: the page it opens checks access itself
    if (link.ability && !(await abilityAllows(ctx, link.ability))) continue
    entries.push({
      group: link.group ?? null,
      order: link.order,
      item: {
        kind: 'link',
        name: `link-${index}`,
        label: link.label,
        icon: link.icon ?? null,
        href: link.url,
        external: isExternalUrl(link.url),
      },
    })
  }

  const groups = new Map<string | null, NavigationGroup>()
  for (const entry of entries.sort(byOrder)) {
    if (!groups.has(entry.group)) groups.set(entry.group, { label: entry.group, items: [] })
    groups.get(entry.group)!.items.push(entry.item)
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
