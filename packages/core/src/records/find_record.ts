import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { LucidModel, LucidRow, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import type { Resource } from '../resources/define_resource.ts'

/**
 * Postgres rejects an id that doesn't fit the key's type, "abc" or
 * "99999999999" for an integer key, with `invalid_text_representation`
 * or `numeric_value_out_of_range`. That's a record that can't exist,
 * not a server error.
 */
export const IMPOSSIBLE_KEY = new Set(['22P02', '22003'])

/**
 * The first record whose `column` is `value`, or `null`, including
 * when the key can't exist. Inside a transaction (an app's tests run in
 * a global one) the lookup gets a savepoint: a rejected key aborts a
 * Postgres transaction, and every query after it would fail.
 */
export async function firstByKey(
  query: ModelQueryBuilderContract<LucidModel>,
  column: string,
  value: unknown
): Promise<LucidRow | null> {
  const client = query.client
  try {
    if (client.isTransaction) {
      return await (client as TransactionClientContract).transaction((savepoint) =>
        query
          .useTransaction(savepoint)
          .where(column, value as never)
          .first()
      )
    }
    return await query.where(column, value as never).first()
  } catch (error) {
    if (IMPOSSIBLE_KEY.has((error as { code?: string }).code ?? '')) return null
    throw error
  }
}

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
  return firstByKey(query, key, id)
}
