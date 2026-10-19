import type { NavigationGroup, NavigationItem } from '../schema.ts'

/** A navigation item's key: names are unique only within a kind */
export function navigationKey(item: Pick<NavigationItem, 'kind' | 'name'>): string {
  return `${item.kind}:${item.name}`
}

/** A URL's path and its query, sorted, so `?b=2&a=1` matches `?a=1&b=2` */
function pathAndQuery(url: string): { path: string; query: string } {
  const parsed = new URL(url, 'http://azu.local')
  parsed.searchParams.sort()
  return { path: parsed.pathname.replace(/\/+$/, '') || '/', query: parsed.searchParams.toString() }
}

/**
 * Which navigation item is the current page (FR-16, FR-21): a link whose
 * path and query both match the URL; otherwise the resource or screen
 * whose URL the page is under (`/admin/resources/orders/3` is Orders).
 * Matching a link first means "Awaiting shipping" is current on
 * `/admin/resources/orders?status=paid`, not Orders. The item's key,
 * `navigationKey()`, or `null` when none is.
 */
export function currentNavigationItem(url: string, groups: NavigationGroup[]): string | null {
  const items = groups.flatMap((group) => group.items)
  const here = pathAndQuery(url)
  for (const item of items) {
    if (item.kind !== 'link' || item.external) continue
    const target = pathAndQuery(item.href)
    if (target.path === here.path && target.query === here.query) return navigationKey(item)
  }
  for (const item of items) {
    if (item.kind === 'link') continue
    const target = pathAndQuery(item.href).path
    if (here.path === target || here.path.startsWith(`${target}/`)) return navigationKey(item)
  }
  return null
}
