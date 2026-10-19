import type { FormFieldSchema, RelationTable, ResourceSchema } from '../schema.ts'
import { PAGE_SLOTS, type SlotPage } from './slots.ts'

/**
 * The name an app component registers under, from its file in
 * `inertia/admin/components`: `sku_input.tsx` → `SkuInput`. The admin
 * entry registers components this way, and `admin:doctor` checks that
 * every name a resource uses has a file.
 */
export function componentName(path: string): string {
  const file = path
    .split('/')
    .pop()!
    .replace(/\.[jt]sx?$/, '')
  return file
    .split(/[_-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

/**
 * The app component names a page renders, from its name (`azu/` or not)
 * and props: the list's columns, the form's fields, the columns of a
 * detail page's `hasMany` tables, action dialog fields on the list and
 * detail pages, and the page's slots. The admin app loads these before
 * it renders the page, so lazily registered components are ready on
 * first paint, and a page loads only the components it shows.
 */
export function usedComponentNames(name: string, props: unknown): Set<string> {
  const page = name.replace(/^azu\//, '')
  const data = (props ?? {}) as {
    resource?: Partial<Pick<ResourceSchema, 'columns' | 'actions' | 'slots'>>
    form?: { fields?: Pick<FormFieldSchema, 'component'>[] }
    relations?: Pick<RelationTable, 'columns'>[]
  }
  const resource = data.resource ?? {}
  const actionFields = (resource.actions ?? []).flatMap((action) => action.fields ?? [])
  const used: { component: string | null }[] =
    page === 'resource/index'
      ? [...(resource.columns ?? []), ...actionFields]
      : page === 'resource/show'
        ? [...(data.relations ?? []).flatMap((table) => table.columns ?? []), ...actionFields]
        : (data.form?.fields ?? [])
  const slotPage = page.replace(/^resource\//, '') as SlotPage
  const slots = (PAGE_SLOTS[slotPage] ?? []).map((slot) => resource.slots?.[slot] ?? null)
  return new Set(
    [...used.map((item) => item.component), ...slots].filter(
      (component): component is string => typeof component === 'string'
    )
  )
}
