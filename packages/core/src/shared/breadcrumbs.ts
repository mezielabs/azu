import type { ResourceSchema, ScreenSchema } from '../schema.ts'

export type BreadcrumbItem = { label: string; href?: string }

/**
 * A resource page's breadcrumb: its navigation group (not a link), then
 * the resource's list, linked, then any deeper levels. The list page
 * passes `list: false`, since it is the list.
 */
export function resourceBreadcrumbs(
  resource: Pick<ResourceSchema, 'group' | 'label'>,
  listUrl: string,
  options: { list?: boolean; trail?: BreadcrumbItem[] } = {}
): BreadcrumbItem[] {
  return [
    ...(resource.group ? [{ label: resource.group }] : []),
    ...(options.list === false ? [] : [{ label: resource.label, href: listUrl }]),
    ...(options.trail ?? []),
  ]
}

/**
 * A screen's breadcrumb (FR-20): its group (not a link), then its
 * label. A screen without a group has none, since the label alone would
 * only repeat the page's title.
 */
export function screenBreadcrumbs(screen: Pick<ScreenSchema, 'group' | 'label'>): BreadcrumbItem[] {
  return screen.group ? [{ label: screen.group }, { label: screen.label }] : []
}
