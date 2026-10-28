import type { HttpContext } from '@adonisjs/core/http'
import type { LucidModel, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import type { DateTime } from 'luxon'
import { introspectTable } from '../generator/introspect_db.ts'
import { columnName, listRecords } from '../list/list_records.ts'
import { databaseDateTime } from '../list/filters.ts'
import { allows } from '../resources/abilities.ts'
import { humanize } from '../resources/labels.ts'
import type { PartitionRow, TrendBucket, WidgetData, WidgetSchema } from '../schema.ts'
import { abilityAllows } from '../screens/abilities.ts'
import { parseFilterValue } from '../shared/list_filters.ts'
import { compareValues, type RangeInfo, type RangeName } from '../shared/metrics.ts'
import type { PageSize } from '../shared/list_state.ts'
import { addDecimals, decimalResult } from './decimals.ts'
import type { AnyResource, LinkFilters, ScreenWidget, Widget, WidgetState } from './metrics.ts'
import { periodBounds, type Bounds, type RangeBounds } from './ranges.ts'
import { TooManyBuckets, bucketBounds, bucketFor, type Bucket } from './buckets.ts'

/** What computing a widget needs from the panel */
export type WidgetContext = { path: string; timezone: string; defaultDisk?: string }

/** Rows a partition shows before "Other", and a table's, by default */
const DEFAULT_LIMIT = 5

/** A widget the user may see, with the page prop its data arrives in */
export type VisibleWidget = { key: string; widget: ScreenWidget }

/**
 * The widgets this user may see (FR-24): a resource-backed widget needs
 * the resource's `viewList`, a `using()` one its ability, both failing
 * closed. The others are left out of the page entirely.
 */
export async function visibleWidgets(
  ctx: HttpContext,
  widgets: readonly ScreenWidget[]
): Promise<VisibleWidget[]> {
  const visible: VisibleWidget[] = []
  for (const [index, widget] of widgets.entries()) {
    const { resource, ability } = widget.state
    const allowed = resource
      ? await allows(ctx, resource, 'viewList')
      : ability
        ? await abilityAllows(ctx, ability)
        : false
    if (allowed) visible.push({ key: `widget${index}`, widget })
  }
  return visible
}

/** Default widths: tables span two columns, everything else one */
const WIDTHS: Record<WidgetState['kind'], WidgetSchema['width']> = {
  value: 1,
  progress: 1,
  partition: 1,
  table: 2,
  trend: 4,
}

/**
 * How the page lists a widget before its data loads
 */
export function widgetSchema(key: string, widget: Widget): WidgetSchema {
  const { state } = widget
  const ranged = state.dateColumn !== null || state.using !== null
  return {
    key,
    kind: state.kind,
    label: state.label,
    width: state.width ?? WIDTHS[state.kind],
    format: state.format,
    compact: state.compact,
    // Progress has its own period; a table without date() just lists
    note: !ranged && (state.kind === 'value' || state.kind === 'partition') ? 'All time' : null,
    compares:
      (state.kind === 'value' && ranged && state.compare) ||
      (state.kind === 'trend' && state.compare),
    better: state.better,
  }
}

/**
 * A widget's data, computed on its own (FR-24). A widget that throws is
 * logged with the screen's and the widget's names and comes back as an
 * error, so the rest of the page still renders.
 */
export async function widgetData(
  ctx: HttpContext,
  context: WidgetContext,
  screen: string,
  widget: Widget,
  range: { name: RangeName; bounds: RangeBounds; info: RangeInfo }
): Promise<WidgetData> {
  try {
    switch (widget.state.kind) {
      case 'value':
        return await valueData(ctx, context, widget.state, range)
      case 'progress':
        return await progressData(ctx, context, widget.state)
      case 'partition':
        return await partitionData(context, widget.state, range)
      case 'table':
        return await tableData(ctx, context, widget.state, range)
      case 'trend':
        return await trendData(context, widget.state, range)
    }
  } catch (error) {
    // Too many buckets is the screen's ranges, not a fault: say why
    if (error instanceof TooManyBuckets) {
      ctx.logger.warn(
        `Azu's "${widget.state.label}" trend on the "${screen}" screen has too many buckets for this range`
      )
      return { status: 'error', message: error.message }
    }
    ctx.logger.error(
      { err: error },
      `Azu couldn't load the "${widget.state.label}" widget on the "${screen}" screen`
    )
    return { status: 'error' }
  }
}

/**
 * The resource's query, then the widget's `where()`: every metric query
 * starts from the resource's `query` hook, so a scoped resource never
 * totals records its user couldn't list.
 */
function baseQuery(state: WidgetState): ModelQueryBuilderContract<LucidModel> {
  const resource = state.resource!
  const query = resource.model.query()
  resource.options.query?.(query)
  state.where?.(query)
  return query
}

/** A model attribute as a qualified database column, safe beside a hook's joins */
function qualified(model: LucidModel, attribute: string): string {
  return `${model.table}.${columnName(model, attribute)}`
}

function isDateOnly(model: LucidModel, attribute: string): boolean {
  return (model.$getColumn(attribute)?.meta as { type?: string } | undefined)?.type === 'date'
}

/**
 * Narrows a query to `bounds` on the `date()` column. Datetimes compare
 * instants, in the form Lucid stores them; a date column compares
 * whole days in the admin's timezone.
 */
function withinBounds(
  query: ModelQueryBuilderContract<LucidModel>,
  state: WidgetState,
  bounds: Bounds
) {
  const model = state.resource!.model
  const column = qualified(model, state.dateColumn!)
  if (isDateOnly(model, state.dateColumn!)) {
    query.where(column, '>=', bounds.start.toISODate()!)
    // A period ending at midnight doesn't include that day
    if (bounds.end.equals(bounds.end.startOf('day'))) {
      query.where(column, '<', bounds.end.toISODate()!)
    } else {
      query.where(column, '<=', bounds.end.toISODate()!)
    }
    return
  }
  const format = query.client.dialect.dateTimeFormat
  query.where(column, '>=', databaseDateTime(bounds.start.toMillis(), format))
  // Stored to the second: a range ending now includes this second's
  // records; one ending exactly on a second (midnight) still excludes it
  const end = Math.ceil(bounds.end.toMillis() / 1000) * 1000
  query.where(column, '<', databaseDateTime(end, format))
}

/** Decimal scales by table and column, read once per process */
const scales = new Map<string, Promise<Map<string, number | null>>>()

/**
 * A column's decimal scale from the database, `null` if it has none or
 * the database can't say
 */
async function columnScale(model: LucidModel, attribute: string): Promise<number | null> {
  const client = model.query().client
  const key = `${client.connectionName}:${model.table}`
  if (!scales.has(key)) {
    scales.set(
      key,
      introspectTable(client, model.table).then(
        (columns) => new Map(columns.map((column) => [column.name, column.scale])),
        () => new Map()
      )
    )
  }
  const known = await scales.get(key)!
  return known.get(columnName(model, attribute)) ?? null
}

/**
 * The scale a widget's result is written with: none for counts, the
 * column's for decimals (2 if unknown), and 2 places for an average of
 * a number column
 */
async function resultScale(state: WidgetState): Promise<number | null> {
  if (state.aggregate === 'count' || !state.column) return null
  const resource = state.resource!
  const decimal = resource
    .toSchema()
    .columns.some((column) => column.name === state.column && column.kind === 'decimal')
  if (decimal) return (await columnScale(resource.model, state.column)) ?? 2
  return state.aggregate === 'avg' ? 2 : null
}

/**
 * The aggregate on the column, optionally within `bounds`, as an exact
 * decimal string
 */
async function aggregate(
  state: WidgetState,
  bounds: Bounds | null,
  narrow?: (query: ModelQueryBuilderContract<LucidModel>) => void
): Promise<string> {
  const query = baseQuery(state)
  narrow?.(query)
  if (bounds && state.dateColumn) withinBounds(query, state, bounds)
  query.clearSelect().clearOrder()
  const model = state.resource!.model
  if (state.aggregate === 'count') query.count('* as value')
  else query[state.aggregate!](`${qualified(model, state.column!)} as value`)
  const [row] = await query.pojo<{ value: unknown }>()
  return decimalResult(row?.value, await resultScale(state))
}

/**
 * A list URL with the given filters
 */
function listHref(path: string, resource: AnyResource, filters: Record<string, string>) {
  const query = new URLSearchParams(filters).toString()
  return `${path}/resources/${resource.name}${query ? `?${query}` : ''}`
}

/**
 * A `link()` filter value as the list reads it from its URL, or `null`
 * if it doesn't fit the filter
 */
export function linkFilterValue(
  resource: AnyResource,
  name: string,
  value: LinkFilters[string]
): string | null {
  const filter = resource.filters().find((item) => item.name === name)
  if (!filter) return null
  const schema = filter.toJSON()
  const raw =
    schema.kind === 'custom'
      ? value === true || value === 1 || value === '1'
        ? '1'
        : ''
      : String(value)
  return parseFilterValue(schema, raw)
}

/**
 * The list filters a widget's link carries (FR-24): the range, as the
 * resource's `dateRange` filter on the widget's `date()` column when
 * it has one, then the widget's own `link()` filters.
 */
function linkFilters(state: WidgetState, info: RangeInfo | null): Record<string, string> {
  const resource = state.resource!
  const filters: Record<string, string> = {}
  if (info && state.dateColumn) {
    const range = resource
      .filters()
      .find((item) => item.kind === 'dateRange' && item.name === state.dateColumn)
    if (range) filters[range.name] = `${info.from}..${info.to}`
  }
  for (const [name, value] of Object.entries(state.link ?? {})) {
    const encoded = linkFilterValue(resource, name, value)
    if (encoded !== null) filters[name] = encoded
  }
  return filters
}

async function valueData(
  ctx: HttpContext,
  context: WidgetContext,
  state: WidgetState,
  range: { name: RangeName; bounds: RangeBounds; info: RangeInfo }
): Promise<WidgetData> {
  if (state.using) {
    const call = async (bounds: Bounds) =>
      decimalResult(await state.using!(ctx, { name: range.name, ...bounds }), null)
    const value = await call(range.bounds)
    const previous = state.compare ? await call(range.bounds.previous) : null
    return {
      status: 'ok',
      kind: 'value',
      value,
      previous,
      comparison: previous === null ? null : compareValues(value, previous, state.better),
      href: null,
    }
  }

  const ranged = state.dateColumn !== null
  const [value, previous] = await Promise.all([
    aggregate(state, ranged ? range.bounds : null),
    ranged && state.compare ? aggregate(state, range.bounds.previous) : Promise.resolve(null),
  ])
  return {
    status: 'ok',
    kind: 'value',
    value,
    previous,
    comparison: previous === null ? null : compareValues(value, previous, state.better),
    href: state.link
      ? listHref(context.path, state.resource!, linkFilters(state, ranged ? range.info : null))
      : null,
  }
}

/** A progress period's name, in English: "October 2026", "Q4 2026" */
function periodName(period: WidgetState['period'], start: DateTime): string {
  const date = start.setLocale('en')
  switch (period) {
    case 'day':
      return date.toFormat('d LLLL yyyy')
    case 'week':
      return `Week of ${date.toFormat('d LLL yyyy')}`
    case 'month':
      return date.toFormat('LLLL yyyy')
    case 'quarter':
      return `Q${date.quarter} ${date.year}`
    case 'year':
      return String(date.year)
  }
}

async function progressData(
  ctx: HttpContext,
  context: WidgetContext,
  state: WidgetState
): Promise<WidgetData> {
  const period = periodBounds(state.period, context.timezone)
  const value = await aggregate(state, { start: period.start, end: period.now })
  const goal = typeof state.goal === 'function' ? await state.goal(ctx) : (state.goal ?? 0)
  const target = Number(goal)
  return {
    status: 'ok',
    kind: 'progress',
    value,
    goal: decimalResult(target, null),
    share: target > 0 ? Number(value) / target : 0,
    pace: period.elapsed,
    period: periodName(state.period, period.start),
    remaining: Math.max(0, period.end.toMillis() - period.now.toMillis()),
  }
}

/**
 * Labels for a column's values, in their order: the resource's select
 * field options, else its column's labels (a select field's or select
 * filter's), else the select filter's options
 */
function valueOptions(resource: AnyResource, column: string): Record<string, string> | null {
  const schema = resource.toSchema()
  return (
    schema.fields.find((field) => field.name === column && field.kind === 'select')?.options ??
    schema.columns.find((item) => item.name === column)?.labels ??
    schema.filters.find((item) => item.name === column && item.kind === 'select')?.options ??
    null
  )
}

/** A value's label: its option's, else the value in sentence case */
function valueLabel(options: Record<string, string> | null, key: string | null): string {
  if (key === null || key === '') return 'None'
  return options?.[key] ?? humanize(key)
}

/** A grouped value as a string key: booleans and numbers as text */
function groupKey(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

async function partitionData(
  context: WidgetContext,
  state: WidgetState,
  range: { bounds: RangeBounds; info: RangeInfo }
): Promise<WidgetData> {
  const resource = state.resource!
  const model = resource.model
  const column = qualified(model, state.groupBy!)
  const query = baseQuery(state)
  if (state.dateColumn) withinBounds(query, state, range.bounds)
  query.clearSelect().clearOrder().select(`${column} as group_key`).groupBy(column)
  if (state.aggregate === 'count') query.count('* as value')
  else query[state.aggregate!](`${qualified(model, state.column!)} as value`)
  const scale = await resultScale(state)
  const results = await query.pojo<{
    group_key: string | number | boolean | Date | null
    value: unknown
  }>()
  // Largest first; ties in the options' order, then by label, so the
  // rows never swap places between loads or databases
  const options = valueOptions(resource, state.groupBy!)
  const order = Object.keys(options ?? {})
  const rank = (key: string | null) => {
    const index = key === null ? -1 : order.indexOf(key)
    return index === -1 ? order.length : index
  }
  const groups = results
    .map((row) => {
      const key = groupKey(row.group_key)
      return {
        key,
        rawKey: row.group_key,
        label: valueLabel(options, key),
        value: decimalResult(row.value, scale),
      }
    })
    .sort(
      (a, b) =>
        Number(b.value) - Number(a.value) ||
        rank(a.key) - rank(b.key) ||
        a.label.localeCompare(b.label, 'en')
    )

  const limit = state.limit ?? DEFAULT_LIMIT
  const shown = groups.slice(0, limit)
  const rest = groups.slice(limit)
  const additive = state.aggregate === 'count' || state.aggregate === 'sum'
  const bounds = state.dateColumn ? range.bounds : null
  // Non-additive aggregates must run over the records, not their rounded
  // group values. Keep original database keys for booleans, dates and nulls.
  const [total, other] = await Promise.all([
    additive ? addDecimals(groups.map((group) => group.value)) : aggregate(state, bounds),
    rest.length === 0
      ? null
      : additive
        ? addDecimals(rest.map((group) => group.value))
        : aggregate(state, bounds, (omitted) => {
            const keys = rest.flatMap((group) => (group.rawKey === null ? [] : [group.rawKey]))
            omitted.where((subset) => {
              if (keys.length) subset.whereIn(column, keys)
              if (rest.some((group) => group.rawKey === null)) subset.orWhereNull(column)
            })
          }),
  ])
  const largest = Math.max(0, ...shown.map((group) => Number(group.value)), Number(other ?? 0))

  // Rows link to the list filtered by their value, when the resource can filter by it
  const select = resource
    .filters()
    .find((item) => item.kind === 'select' && item.name === state.groupBy)
  const filters = linkFilters(state, state.dateColumn ? range.info : null)
  const row = (
    key: string | null,
    label: string,
    value: string,
    linkable: boolean
  ): PartitionRow => ({
    key,
    label,
    value,
    share: largest > 0 ? Number(value) / largest : 0,
    percent: additive ? (Number(total) > 0 ? Number(value) / Number(total) : 0) : null,
    href:
      linkable && select && key !== null && linkFilterValue(resource, select.name, key) !== null
        ? listHref(context.path, resource, { ...filters, [select.name]: key })
        : null,
  })

  const rows = shown.map((group) => row(group.key, group.label, group.value, true))
  if (rest.length > 0) {
    rows.push(row(null, 'Other', other!, false))
  }
  return {
    status: 'ok',
    kind: 'partition',
    rows,
    total,
    unit:
      state.aggregate === 'count'
        ? { one: resource.singularLabel.toLowerCase(), other: resource.label.toLowerCase() }
        : null,
  }
}

async function tableData(
  ctx: HttpContext,
  context: WidgetContext,
  state: WidgetState,
  range: { bounds: RangeBounds; info: RangeInfo }
): Promise<WidgetData> {
  const resource = state.resource!
  const limit = state.limit ?? DEFAULT_LIMIT
  // Through the list's own code: the resource's columns, its query hook
  // and preloads (no N+1), and a `view` check per row for its link
  const list = await listRecords(
    ctx,
    resource,
    {
      page: 1,
      perPage: limit as PageSize,
      sort: state.orderBy?.column ?? null,
      direction: state.orderBy?.direction ?? 'desc',
      search: '',
      filters: {},
      columns: null,
    },
    {
      scope: (query) => {
        state.where?.(query)
        if (state.dateColumn) withinBounds(query, state, range.bounds)
      },
      defaultDisk: context.defaultDisk,
      timezone: context.timezone,
    }
  )
  const all = resource.toSchema().columns
  const columns = (
    state.columns
      ? state.columns.map((name) => all.find((column) => column.name === name)!).filter(Boolean)
      : all
  ).map((column) => ({ ...column, sortable: false }))
  return {
    status: 'ok',
    kind: 'table',
    resource: resource.name,
    columns,
    titleColumn: resource.options.title ?? null,
    rows: list.rows,
    total: list.meta.total,
    href: state.link
      ? listHref(context.path, resource, linkFilters(state, state.dateColumn ? range.info : null))
      : null,
  }
}

/**
 * The unit a trend counts in: its own `by()`, else the range's. A date
 * column has no hours, so it counts days instead.
 */
export function trendUnit(state: WidgetState, range: RangeName) {
  const unit = state.bucket ?? bucketFor(range)
  return unit === 'hour' && isDateOnly(state.resource!.model, state.dateColumn!) ? 'day' : unit
}

/**
 * Each bucket's aggregate (FR-25), in one query: a CASE maps the date
 * column to its bucket's index by the boundaries Luxon worked out in the
 * admin's timezone, and the query groups by that index. No dialect date
 * functions or timezone tables: the boundaries are plain values, in the
 * form the column stores them, so Postgres, MySQL and SQLite agree, and
 * clock changes are already in them. Empty buckets come back as 0.
 */
async function bucketValues(
  state: WidgetState,
  buckets: Bucket[],
  bounds: Bounds
): Promise<string[]> {
  const model = state.resource!.model
  const column = qualified(model, state.dateColumn!)
  const dateOnly = isDateOnly(model, state.dateColumn!)
  const query = baseQuery(state)
  // Only the range: the first bucket may start before it (a week), the
  // last end after it (now)
  withinBounds(query, state, bounds)
  const format = query.client.dialect.dateTimeFormat
  const boundary = (value: DateTime) =>
    dateOnly ? value.toISODate()! : databaseDateTime(value.toMillis(), format)

  query.clearSelect().clearOrder()
  if (buckets.length > 1) {
    const whens = buckets.slice(1).map((_, index) => `WHEN ?? < ? THEN ${index}`)
    const bindings = buckets.slice(1).flatMap((bucket) => [column, boundary(bucket.start)])
    query.select(
      query.client.raw(
        `CASE ${whens.join(' ')} ELSE ${buckets.length - 1} END as bucket_index`,
        bindings
      )
    )
  }
  if (state.aggregate === 'count') query.count('* as value')
  else query[state.aggregate!](`${qualified(model, state.column!)} as value`)
  if (buckets.length > 1) query.groupByRaw('1')

  const scale = await resultScale(state)
  const values = buckets.map(() => decimalResult(0, scale))
  const rows = await query.pojo<{ bucket_index?: unknown; value: unknown }>()
  for (const row of rows) {
    const index = buckets.length > 1 ? Number(row.bucket_index) : 0
    if (index >= 0 && index < values.length) values[index] = decimalResult(row.value, scale)
  }
  return values
}

async function trendData(
  context: WidgetContext,
  state: WidgetState,
  range: { name: RangeName; bounds: RangeBounds; info: RangeInfo }
): Promise<WidgetData> {
  const resource = state.resource!
  const unit = trendUnit(state, range.name)
  const buckets = bucketBounds(unit, range.bounds, context.timezone)
  const previousBuckets = state.compare
    ? bucketBounds(unit, range.bounds.previous, context.timezone)
    : null
  const [values, previous] = await Promise.all([
    bucketValues(state, buckets, range.bounds),
    previousBuckets
      ? bucketValues(state, previousBuckets, range.bounds.previous)
      : Promise.resolve(null),
  ])

  // Days, weeks and months link to the list filtered to them, when the
  // resource can filter the column by date; never past the range
  const dateRange = resource
    .filters()
    .find((item) => item.kind === 'dateRange' && item.name === state.dateColumn)
  const filters = linkFilters({ ...state, dateColumn: null }, null)
  const days = (bucket: Bucket) => {
    const from = bucket.start < range.bounds.start ? range.bounds.start : bucket.start
    const last = bucket.end.minus({ days: 1 })
    const to = last > range.bounds.end ? range.bounds.end : last
    return `${from.toISODate()}..${to.toISODate()}`
  }

  // A previous period with fewer buckets: the rest are empty, at the same scale
  const zero = decimalResult(0, values[0]?.split('.')[1]?.length ?? null)
  const rows: TrendBucket[] = buckets.map((bucket, index) => ({
    start: bucket.start.toISO()!,
    end: bucket.end.toISO()!,
    value: values[index],
    // Aligned by position: the nth bucket of each period
    previous: previous ? (previous[index] ?? zero) : null,
    previousStart: previousBuckets?.[index]?.start.toISO() ?? null,
    previousEnd: previousBuckets?.[index]?.end.toISO() ?? null,
    href:
      dateRange && unit !== 'hour'
        ? listHref(context.path, resource, { ...filters, [dateRange.name]: days(bucket) })
        : null,
  }))
  return {
    status: 'ok',
    kind: 'trend',
    unit,
    chart: state.chart,
    buckets: rows,
    total: addDecimals(values),
    previousTotal: previous ? addDecimals(previous.slice(0, buckets.length)) : null,
    noun: resource.label.toLowerCase(),
  }
}
