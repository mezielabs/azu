import type { HttpContext } from '@adonisjs/core/http'
import type { LucidModel, LucidRow } from '@adonisjs/lucid/types/model'
import type { Azu } from '../azu.ts'
import { columnName, listRecords, whereSearch } from '../list/list_records.ts'
import { allows } from '../resources/abilities.ts'
import type { Resource } from '../resources/define_resource.ts'
import type {
  ColumnSchema,
  FieldSchema,
  RelationOption,
  RelationTable,
  RelationValue,
} from '../schema.ts'
import type { AzuConfig } from '../types.ts'

export type RelationsContext = { config: AzuConfig; azu: Azu }

/**
 * Keys of a `belongsTo`, `hasMany`, or `manyToMany` relation, from Lucid's own
 * metadata:
 *
 * - `belongsTo`: `foreignKey` is on this model (`categoryId`),
 *   `localKey` on the related one (`id`).
 * - `hasMany`: `localKey` is on this model (`id`), `foreignKey` on the
 *   related one (`categoryId`).
 * - `manyToMany`: `relatedKey` is on the related model; pivot rows store it.
 */
export type RelationKeys = {
  type: string
  related: LucidModel
  foreignKey: string
  localKey: string
  relatedKey: string
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
  relatedKey?: string
  foreignKeyColumnName: string
  localKeyColumnName: string
}

/** The relation kinds a field can pick records for */
const PICKER_RELATIONS = new Set(['belongsTo', 'manyToMany'])

export function relationKeys(model: LucidModel, name: string): RelationKeys | null {
  const relation = model.$getRelation(name as never) as LucidRelation | undefined
  if (!relation) return null
  if (!relation.booted) relation.boot()
  return {
    type: relation.type,
    related: relation.relatedModel(),
    foreignKey: relation.foreignKey,
    localKey: relation.localKey,
    relatedKey: relation.relatedKey ?? relation.relatedModel().primaryKey,
    foreignKeyColumnName: relation.foreignKeyColumnName,
    localKeyColumnName: relation.localKeyColumnName,
  }
}

/** The key Lucid expects when assigning or syncing a picker selection. */
export function relationValueKey(keys: RelationKeys, record: LucidRow): string | number {
  const key = keys.type === 'manyToMany' ? keys.relatedKey : keys.localKey
  return read(record, key) as string | number
}

function read(record: LucidRow, attribute: string): unknown {
  return (record as unknown as Record<string, unknown>)[attribute]
}

/**
 * The attribute that names a related record: the field's
 * `searchable()`, else the related resource's `title`.
 */
function titleAttribute(
  field: Pick<FieldSchema, 'searchable'>,
  related: Resource<any, any> | undefined
) {
  return field.searchable ?? related?.options.title ?? null
}

export function titleOf(record: LucidRow, attribute: string | null) {
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
    id: relationValueKey(keys, related),
    title: titleOf(related, titleAttribute(field, resource)),
    href: viewable
      ? `${context.config.path}/resources/${resource!.name}/${related.$primaryKeyValue}`
      : null,
  }
}

/**
 * Most related records a `manyToMany` field shows and edits. A form
 * picker holds a handful; past this, a `hasMany`-style table fits.
 */
export const MANY_TO_MANY_LIMIT = 200

/**
 * The records a `manyToMany` field has attached (FR-09), through the
 * related resource's `query` hook, by title, each with a link to its
 * detail page when the user may `view` it.
 */
export async function manyToManyValues(
  ctx: HttpContext,
  context: RelationsContext,
  model: LucidModel,
  field: FieldSchema,
  record: LucidRow
): Promise<RelationValue[]> {
  const keys = relationKeys(model, field.name)
  if (!keys || keys.type !== 'manyToMany') return []
  const resource = context.azu.resources.forModel(keys.related)
  const title = titleAttribute(field, resource)

  const related = await scopedAttachments(context, keys, field, record)

  return Promise.all(
    related.map(async (item) => {
      const viewable = resource ? await allows(ctx, resource, 'view', item) : false
      return {
        id: relationValueKey(keys, item),
        title: titleOf(item, title),
        href: viewable
          ? `${context.config.path}/resources/${resource!.name}/${item.$primaryKeyValue}`
          : null,
      }
    })
  )
}

/** Use the same bounded, scoped selection for display and editability checks. */
async function scopedAttachments(
  context: RelationsContext,
  keys: RelationKeys,
  field: FieldSchema,
  record: LucidRow
): Promise<LucidRow[]> {
  const resource = context.azu.resources.forModel(keys.related)
  const title = titleAttribute(field, resource)
  // The relation's query builder is a model query on the related model
  const query = (
    record as unknown as { related(name: string): { query(): ReturnType<LucidModel['query']> } }
  )
    .related(field.name)
    .query()
  resource?.options.query?.(query)
  const primary = `${keys.related.table}.${columnName(keys.related, keys.related.primaryKey)}`
  const label = title ? `${keys.related.table}.${columnName(keys.related, title)}` : null
  // Group only scalar record keys/titles before applying the limit. An
  // aggregate keeps Lucid from adding pivot metadata to this selection;
  // differing pivot rows must not count as different picker records.
  const columns = label ? [primary, label] : [primary]
  query.clearSelect().select(columns).groupBy(columns).count('* as attachment_rows').clearOrder()
  if (label) query.orderBy(label, 'asc')
  const selected = (await query.orderBy(primary, 'asc').limit(MANY_TO_MANY_LIMIT)) as LucidRow[]
  if (selected.length === 0) return []

  // Fetch full models for per-record policies on the same connection. Grouping
  // is limited to scalar keys/titles: full records can contain JSON columns.
  const records = keys.related.query({ client: query.client }).whereIn(
    primary,
    selected.map((item) => item.$primaryKeyValue as string | number)
  )
  if (label) records.orderBy(label, 'asc')
  const related = await records.orderBy(primary, 'asc')

  return related
}

/** Incomplete selections cannot safely replace the entire pivot set. */
export async function manyToManyReadOnlyReason(
  context: RelationsContext,
  model: LucidModel,
  field: FieldSchema,
  record: LucidRow
): Promise<string | null> {
  const count = await manyToManyCount(model, record, field.name)
  const reason = tooManyAttached(field, count)
  if (reason || count === 0) return reason
  const keys = relationKeys(model, field.name)
  if (!keys || keys.type !== 'manyToMany') return null
  const visible = await scopedAttachments(context, keys, field, record)
  const shown = new Set(visible.map((item) => relationValueKey(keys, item)))
  return shown.size === count
    ? null
    : `Some attached ${field.label.toLowerCase()} are hidden from you, so this field can't be edited here.`
}

/**
 * The keys a `manyToMany` field has attached, unscoped: what a
 * read-only field hands the validator on edit.
 */
export async function manyToManyIds(
  model: LucidModel,
  record: LucidRow,
  name: string
): Promise<(string | number)[]> {
  const keys = relationKeys(model, name)
  if (!keys || keys.type !== 'manyToMany') return []
  const related = (await (
    record as unknown as { related(name: string): { query(): Promise<LucidRow[]> } }
  )
    .related(name)
    .query()) as LucidRow[]
  return related.map((item) => relationValueKey(keys, item))
}

/**
 * How many distinct related keys a `manyToMany` field has attached,
 * counted on the unscoped pivot so duplicate rows count only once.
 */
export async function manyToManyCount(
  model: LucidModel,
  record: LucidRow,
  name: string
): Promise<number> {
  const relation = model.$getRelation(name)
  if (!relation || relation.type !== 'manyToMany') return 0
  if (!relation.booted) relation.boot()
  const [row] = (await (
    record as unknown as {
      related(name: string): {
        pivotQuery(): {
          countDistinct(column: string, alias: string): { pojo(): Promise<{ total: unknown }[]> }
        }
      }
    }
  )
    .related(name)
    .pivotQuery()
    .countDistinct(relation.pivotRelatedForeignKey, 'total')
    .pojo()) as { total: unknown }[]
  return Number(row?.total ?? 0)
}

/**
 * Why an edit form shows a `manyToMany` field read-only: more records
 * are attached than it loads, so submitting what it shows would detach
 * the rest. `null` when the form can edit them all.
 */
export function tooManyAttached(field: Pick<FieldSchema, 'label'>, count: number): string | null {
  if (count <= MANY_TO_MANY_LIMIT) return null
  const total = new Intl.NumberFormat('en').format(count)
  return `${total} ${field.label.toLowerCase()} attached; too many to edit here`
}

/**
 * Whether the user may list what a `belongsTo` or `manyToMany` field, or
 * a `belongsTo` filter, points at: the related resource's `viewList`.
 * Fails closed: no resource for the related model, or no `viewList` on
 * its policy, means no. Without it, the field is read-only, the filter
 * is left out, and their options endpoints answer 403.
 */
export async function canListRelated(
  ctx: HttpContext,
  context: RelationsContext,
  model: LucidModel,
  field: Pick<FieldSchema, 'name'>
): Promise<boolean> {
  const keys = relationKeys(model, field.name)
  if (!keys || !PICKER_RELATIONS.has(keys.type)) return false
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
): Promise<Record<string, RelationValue | RelationValue[] | null>> {
  const values: Record<string, RelationValue | RelationValue[] | null> = {}
  for (const field of fields) {
    if (field.kind === 'belongsTo') {
      values[field.name] = await belongsToValue(ctx, context, model, field, record)
    } else if (field.kind === 'manyToMany') {
      values[field.name] = await manyToManyValues(ctx, context, model, field, record)
    }
  }
  return values
}

/**
 * Up to 20 records a `belongsTo` field or filter can point at,
 * matching `search` in the title attribute, literally. The related
 * resource's `query` hook applies, so a scoped resource's records stay
 * scoped.
 */
export async function relationOptions(
  context: RelationsContext,
  model: LucidModel,
  field: Pick<FieldSchema, 'name' | 'searchable'>,
  search: string
): Promise<RelationOption[]> {
  const keys = relationKeys(model, field.name)
  if (!keys || !PICKER_RELATIONS.has(keys.type)) return []

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
    id: relationValueKey(keys, related),
    title: titleOf(related, title),
  }))
}

/**
 * A `hasMany` table's columns: the related resource's, less the
 * `belongsTo` column that points back to the parent. On a category's
 * page, every product's Category is that category. It matches on the
 * relation keys, from Lucid's metadata, not on names: a product's
 * `belongsTo` whose `foreignKey` is the `hasMany`'s (`categoryId` for
 * `category.products`) is dropped, whatever the column is called, and a
 * `belongsTo` on another key is kept, even to the same model.
 */
export function hasManyColumns(
  columns: ColumnSchema[],
  related: LucidModel,
  foreignKey: string
): ColumnSchema[] {
  return columns.filter((column) => {
    if (column.kind !== 'belongsTo') return true
    const keys = relationKeys(related, column.name)
    return !(keys?.type === 'belongsTo' && keys.foreignKey === foreignKey)
  })
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
      { page, perPage: RELATION_PAGE_SIZE, sort: null, direction: 'asc', search: '', filters: {} },
      {
        scope: (query) => query.where(keys.foreignKeyColumnName, parentKey as never),
        defaultDisk: context.config.defaultDisk,
      }
    )

    tables.push({
      name: field.name,
      label: field.label,
      resource: related.name,
      columns: hasManyColumns(related.toSchema().columns, keys.related, keys.foreignKey).map(
        (column) => ({ ...column, sortable: false })
      ),
      titleColumn: related.options.title ?? null,
      rows: list.rows,
      meta: list.meta,
      pageParam,
    })
  }

  return tables
}
