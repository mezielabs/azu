import type { LucidModel, LucidRow } from '@adonisjs/lucid/types/model'
import type { Resource } from '../resources/define_resource.ts'

/**
 * Postgres rejects an id that doesn't fit the key's type, "abc" or
 * "99999999999" for an integer key, with `invalid_text_representation`
 * or `numeric_value_out_of_range`. That's a record that can't exist,
 * not a server error.
 */
const IMPOSSIBLE_KEY = new Set(['22P02', '22003'])

/**
 * One record by primary key, through the resource's `query` hook so a
 * scoped resource can't reach records outside its scope. `null` when
 * there's no such record.
 */
export async function findRecord(
  resource: Resource<any, any>,
  id: string
): Promise<LucidRow | null> {
  const model: LucidModel = resource.model
  const query = model.query()
  resource.options.query?.(query)

  const key = model.$getColumn(model.primaryKey)?.columnName ?? model.primaryKey
  try {
    return await query.where(key, id).first()
  } catch (error) {
    if (IMPOSSIBLE_KEY.has((error as { code?: string }).code ?? '')) return null
    throw error
  }
}
