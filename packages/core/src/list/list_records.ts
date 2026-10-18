import type { HttpContext } from '@adonisjs/core/http'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import type { LucidModel, LucidRow, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import { actionAbilities } from '../actions/run_action.ts'
import { processTimezone } from '../define_config.ts'
import { applyFilters } from './filters.ts'
import { allows } from '../resources/abilities.ts'
import { diskFor, fileValue } from '../files/uploads.ts'
import type { Resource } from '../resources/define_resource.ts'
import type { CellValue, ColumnSchema, ListMeta, ListRow } from '../schema.ts'
import type { ListState } from '../shared/list_state.ts'

/**
 * The database column behind a model attribute (`createdAt` →
 * `created_at`).
 */
export function columnName(model: LucidModel, attribute: string): string {
  return model.$getColumn(attribute)?.columnName ?? attribute
}

/**
 * The LIKE escape character. Not a backslash: backslashes need escaping
 * in MySQL string literals and SQLite has no default escape, so an
 * explicit `ESCAPE '!'` means the same thing on every database.
 */
const LIKE_ESCAPE = '!'

/**
 * Makes a search term match literally: `50%` finds "50%", not "50"
 * followed by anything, and `_` matches only an underscore.
 */
export function escapeLike(term: string): string {
  return term.replace(/[!%_]/g, (character) => `${LIKE_ESCAPE}${character}`)
}

/**
 * Matches `term` anywhere in any of `attributes`, literally and
 * case-insensitively: ILIKE on Postgres, LIKE elsewhere (SQLite's ASCII
 * LIKE and MySQL's default collations ignore case).
 */
export function whereSearch(
  query: ModelQueryBuilderContract<LucidModel>,
  model: LucidModel,
  attributes: string[],
  term: string
) {
  if (attributes.length === 0) return
  const pattern = `%${escapeLike(term)}%`
  const operator = query.client.dialect.name === 'postgres' ? 'ILIKE' : 'LIKE'
  query.where((group) => {
    for (const attribute of attributes) {
      group.orWhereRaw(`?? ${operator} ? ESCAPE '${LIKE_ESCAPE}'`, [
        columnName(model, attribute),
        pattern,
      ])
    }
  })
}

function read(record: LucidRow, attribute: string): unknown {
  return (record as unknown as Record<string, unknown>)[attribute]
}

/**
 * Plain values only: Luxon dates become ISO strings, decimals stay the
 * exact strings the driver returns (or become strings, on SQLite).
 */
function cellValue(record: LucidRow, column: ColumnSchema): CellValue {
  const value = (record as unknown as Record<string, unknown>)[column.name]

  if (column.kind === 'belongsTo') {
    const related = value as LucidRow | null | undefined
    if (!related) return null
    const title = (related as unknown as Record<string, unknown>)[column.relationTitle ?? '']
    return {
      id: related.$primaryKeyValue as string | number,
      title: title === null || title === undefined ? null : String(title),
    }
  }

  if (value === null || value === undefined) return column.kind === 'image' ? { url: null } : null

  if (column.kind === 'date' || column.kind === 'datetime') {
    const date = value as { toISO?: () => string | null }
    return typeof date.toISO === 'function' ? date.toISO() : String(value)
  }
  if (column.kind === 'decimal') return String(value)
  if (column.kind === 'number') return typeof value === 'number' ? value : Number(value)
  if (column.kind === 'boolean') return Boolean(value)
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  return String(value)
}

/**
 * The records a list's search and filters match, through the
 * resource's `query` hook: what a list page shows, and what a bulk run
 * on all matching rows (FR-17) acts on.
 */
export function matchingQuery(
  resource: Resource<any, any>,
  state: Pick<ListState, 'search' | 'filters'>,
  options: { timezone: string; client?: QueryClientContract }
): ModelQueryBuilderContract<LucidModel> {
  const model: LucidModel = resource.model
  const query = options.client ? model.query({ client: options.client }) : model.query()
  resource.options.query?.(query)
  if (state.search) whereSearch(query, model, resource.toSchema().search, state.search)
  applyFilters(query, resource, state.filters, { timezone: options.timezone })
  return query
}

/**
 * One page of a resource's records, searched, filtered, sorted and
 * serialised to plain JSON rows.
 *
 * Relations shown in `belongsTo` columns are preloaded with
 * `preloadOnce`, which keeps a preload the resource's `query` hook
 * already set up (with its callback), so a list is never N+1. Each row
 * says whether the user may open it (the policy's `view`).
 */
export async function listRecords(
  ctx: HttpContext,
  resource: Resource<any, any>,
  state: ListState,
  options: {
    /** Narrows the list further, e.g. to one parent's `hasMany` records */
    scope?: (query: ModelQueryBuilderContract<LucidModel>) => void
    /** `defaultDisk` from config/admin.ts, for image columns */
    defaultDisk?: string
    /** The admin's timezone, for `dateRange` filters */
    timezone?: string
  } = {}
): Promise<{ rows: ListRow[]; meta: ListMeta }> {
  const model: LucidModel = resource.model
  const schema = resource.toSchema()
  const query = matchingQuery(resource, state, { timezone: options.timezone ?? processTimezone() })

  for (const column of schema.columns) {
    if (column.kind === 'belongsTo') query.preloadOnce(column.name as never)
  }

  options.scope?.(query)

  if (state.sort) query.orderBy(columnName(model, state.sort), state.direction)
  // A stable tie-break, so a page always holds the same rows
  query.orderBy(columnName(model, model.primaryKey), state.sort ? 'asc' : 'desc')

  const page = await query.paginate(state.page, state.perPage)

  // "32 of 40": the count without search and filters, only when one is on
  let unfilteredTotal: number | null = null
  if (state.search || Object.keys(state.filters).length > 0) {
    const all = model.query()
    resource.options.query?.(all)
    options.scope?.(all)
    const [row] = await all
      .clearSelect()
      .clearOrder()
      .count('* as total')
      .pojo<{ total: number | string }>()
    unfilteredTotal = Number(row?.total ?? 0)
  }
  const title = schema.title

  // An image column's disk: the same-named field's `disk()`, else the default
  const diskOf = (name: string) => {
    const field = schema.fields.find((item) => item.name === name)
    return diskFor({ disk: field?.disk ?? null }, options.defaultDisk)
  }

  const imageCell = async (record: LucidRow, name: string) => {
    const file = await fileValue(ctx, diskOf(name), read(record, name))
    return { url: file?.url ?? null }
  }

  const rows = await Promise.all(
    page.all().map(async (record): Promise<ListRow> => {
      const titleValue = title ? (record as unknown as Record<string, unknown>)[title] : null
      return {
        id: record.$primaryKeyValue as string | number,
        title: titleValue === null || titleValue === undefined ? null : String(titleValue),
        cells: Object.fromEntries(
          await Promise.all(
            schema.columns.map(async (column) => [
              column.name,
              column.kind === 'image'
                ? await imageCell(record, column.name)
                : cellValue(record, column),
            ])
          )
        ),
        abilities: {
          view: await allows(ctx, resource, 'view', record),
          actions: await actionAbilities(ctx, resource, record),
        },
      }
    })
  )

  return {
    rows,
    meta: {
      total: page.total,
      unfilteredTotal,
      perPage: page.perPage,
      currentPage: page.currentPage,
      lastPage: page.lastPage,
    },
  }
}
