import type { ColumnSchema } from '../schema.ts'

/** Apply a local visibility choice only to columns present in the server schema. */
export function visibleListColumns(
  columns: readonly ColumnSchema[],
  requested: readonly string[] | null
) {
  const defaults = columns.filter((column) => !column.hiddenByDefault)
  const selected =
    requested === null ? defaults : columns.filter((column) => requested.includes(column.name))
  // Always retain a usable column when a previous choice no longer exists.
  const visible = selected.length ? selected : defaults.length ? defaults : columns.slice(0, 1)
  return visible.map((column) => ({ ...column, hiddenByDefault: false }))
}
