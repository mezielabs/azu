import type { ColumnSchema, FieldSchema } from '../schema.ts'

/**
 * Where the detail page (layout 3/4) shows each field: images and files
 * in the right-hand column, the rest in the Details list on the left.
 * The resource's first shown badge column (a status, say) is a pill
 * beside the title, so its field of the same name leaves the list.
 */
export function detailLayout(
  fields: FieldSchema[],
  columns: ColumnSchema[]
): { main: FieldSchema[]; media: FieldSchema[]; badge: ColumnSchema | null } {
  const badge = columns.find((column) => column.kind === 'badge' && !column.hiddenByDefault) ?? null
  const media = fields.filter((field) => field.kind === 'image' || field.kind === 'file')
  const main = fields.filter(
    (field) => !media.includes(field) && !(badge && field.name === badge.name)
  )
  return { main, media, badge }
}
