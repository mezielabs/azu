import type { HttpContext } from '@adonisjs/core/http'
import type { LucidModel, LucidRow } from '@adonisjs/lucid/types/model'
import type { Azu } from '../azu.ts'
import { columnName, listRecords, whereSearch } from '../list/list_records.ts'
import { allows } from '../resources/abilities.ts'
import type { Resource } from '../resources/define_resource.ts'
import type { FieldSchema, RelationOption, RelationTable, RelationValue } from '../schema.ts'
import type { AzuConfig } from '../types.ts'

export type RelationsContext = { config: AzuConfig; azu: Azu }

/**
 * Keys of a `belongsTo` or `hasMany` relation, from Lucid's own
 * metadata:
 *
 * - `belongsTo`: `foreignKey` is on this model (`categoryId`),
 *   `localKey` on the related one (`id`).
 * - `hasMany`: `localKey` is on this model (`id`), `foreignKey` on the
 *   related one (`categoryId`).
 */
export type RelationKeys = {
  type: string
  related: LucidModel
  foreignKey: string
  localKey: string
  foreignKeyColumnName: string
  localKeyColumnName: string
}

type LucidRelation = {
  type: string
  booted: boolean
  boot(): void
  relatedModel(): LucidModel
  foreignKey: string
  localKey: string
  foreignKeyColumnName: string
  localKeyColumnName: string
}

export function relationKeys(model: LucidModel, name: string): RelationKeys | null {
  const relation = model.$getRelation(name as never) as LucidRelation | undefined
  if (!relation) return null
  if (!relation.booted) relation.boot()
  return {
    type: relation.type,
    related: relation.relatedModel(),
    foreignKey: relation.foreignKey,
    localKey: relation.localKey,
    foreignKeyColumnName: relation.foreignKeyColumnName,
    localKeyColumnName: relation.localKeyColumnName,
  }
}

function read(record: LucidRow, attribute: string): unknown {
  return (record as unknown as Record<string, unknown>)[attribute]
}

/**
 * The attribute that names a related record: the field's
 * `searchable()`, else the related resource's `title`.
 */
function titleAttribute(field: FieldSchema, related: Resource<any, any> | undefined) {
  return field.searchable ?? related?.options.title ?? null
}

function titleOf(record: LucidRow, attribute: string | null) {
  const value = attribute ? read(record, attribute) : null
  return value === null || value === undefined ? null : String(value)
}

/**
 * The record a `belongsTo` field points at, with its title, and a link
 * to its detail page when there's a resource for it and the user may
 * `view` it.
 */
export async function belongsToValue(
  ctx: HttpContext,
  context: RelationsContext,
  model: LucidModel,
  field: FieldSchema,
  record: LucidRow
): Promise<RelationValue | null> {
  const keys = relationKeys(model, field.name)
  if (!keys || keys.type !== 'belongsTo') return null
  const id = read(record, keys.foreignKey)
  if (id === null || id === undefined) return null

  const related = await keys.related
    .query()
    .where(keys.localKeyColumnName, id as never)
    .first()
  if (!related) return null

  const resource = context.azu.resources.forModel(keys.related)
  const viewable = resource ? await allows(ctx, resource, 'view', related) : false
  return {
    id: related.$primaryKeyValue as string | number,
    title: titleOf(related, titleAttribute(field, resource)),
    href: viewable
      ? `${context.config.path}/resources/${resource!.name}/${related.$primaryKeyValue}`
      : null,
  }
}

/**
 * Whether the user may list what a `belongsTo` field points at: the
 * related resource's `viewList`. Fails closed: no resource for the
 * related model, or no `viewList` on its policy, means no. Without it,
 * the field is read-only and its options endpoint answers 403.
 */
export async function canListRelated(
  ctx: HttpContext,
  context: RelationsContext,
  model: LucidModel,
  field: FieldSchema
): Promise<boolean> {
  const keys = relationKeys(model, field.name)
  if (!keys || keys.type !== 'belongsTo') return false
  const related = context.azu.resources.forModel(keys.related)
  return related ? allows(ctx, related, 'viewList') : false
}

/**
 * Every `belongsTo` field's value for a record, keyed by field name.
 */
export async function relationValues(
  ctx: HttpContext,
  context: RelationsContext,
  model: LucidModel,
  fields: FieldSchema[],
  record: LucidRow
): Promise<Record<string, RelationValue | null>> {
  const values: Record<string, RelationValue | null> = {}
  for (const field of fields) {
    if (field.kind === 'belongsTo') {
      values[field.name] = await belongsToValue(ctx, context, model, field, record)
    }
  }
  return values
}

/**
 * Up to 20 records a `belongsTo` field can point at, matching `search`
 * in the title attribute, literally. The related resource's `query`
 * hook applies, so a scoped resource's records stay scoped.
 */
export async function relationOptions(
  context: RelationsContext,
  model: LucidModel,
  field: FieldSchema,
  search: string
): Promise<RelationOption[]> {
  const keys = relationKeys(model, field.name)
  if (!keys || keys.type !== 'belongsTo') return []

  const resource = context.azu.resources.forModel(keys.related)
  const title = titleAttribute(field, resource)
  const query = keys.related.query()
  resource?.options.query?.(query)
  if (title) {
    if (search) whereSearch(query, keys.related, [title], search)
    query.orderBy(columnName(keys.related, title), 'asc')
  }
  query.orderBy(columnName(keys.related, keys.related.primaryKey), 'asc').limit(20)

  const records = await query
  return records.map((related) => ({
    id: related.$primaryKeyValue as string | number,
    title: titleOf(related, title),
  }))
}

/**
 * Rows per page in a detail page's `hasMany` table.
 */
const RELATION_PAGE_SIZE = 10

const warned = new Set<string>()

/**
 * The detail page's `hasMany` tables: one page each of the related
 * records, through the related resource (its columns, `query` hook and
 * preloads, and a `view` check per row for links). A table shows only
 * when the user passes the related resource's `viewList`; a relation
 * without a resource for its model is skipped, with a warning.
 */
export async function hasManyTables(
  ctx: HttpContext,
  context: RelationsContext,
  resource: Resource<any, any>,
  fields: FieldSchema[],
  record: LucidRow
): Promise<RelationTable[]> {
  const tables: RelationTable[] = []

  for (const field of fields) {
    if (field.kind !== 'hasMany') continue
    const keys = relationKeys(resource.model, field.name)
    if (!keys || keys.type !== 'hasMany') continue

    const related = context.azu.resources.forModel(keys.related)
    if (!related) {
      const key = `${resource.name}.${field.name}`
      if (!warned.has(key)) {
        warned.add(key)
        ctx.logger.warn(
          `Azu skipped the "${field.name}" table on "${resource.name}": no resource is registered for ${keys.related.name}`
        )
      }
      continue
    }
    if (!(await allows(ctx, related, 'viewList'))) continue

    const pageParam = `${field.name}Page`
    const requested = Number(ctx.request.qs()[pageParam])
    const page = Number.isInteger(requested) && requested > 0 ? requested : 1
    const parentKey = read(record, keys.localKey)
    const list = await listRecords(
      ctx,
      related,
      { page, perPage: RELATION_PAGE_SIZE, sort: null, direction: 'asc', search: '' },
      (query) => query.where(keys.foreignKeyColumnName, parentKey as never)
    )

    tables.push({
      name: field.name,
      label: field.label,
      resource: related.name,
      columns: related.toSchema().columns.map((column) => ({ ...column, sortable: false })),
      titleColumn: related.options.title ?? null,
      rows: list.rows,
      meta: list.meta,
      pageParam,
    })
  }

  return tables
}
