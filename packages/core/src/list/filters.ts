import type { HttpContext } from '@adonisjs/core/http'
import type { LucidModel, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import { processTimezone } from '../define_config.ts'
import { instantOf, offsetAt, wallClockAt } from '../forms/datetime_input.ts'
import { firstByKey } from '../records/find_record.ts'
import {
  canListRelated,
  relationKeys,
  titleOf,
  type RelationsContext,
} from '../records/relations.ts'
import type { Resource } from '../resources/define_resource.ts'
import type { FilterSchema, ListFilter, RelationOption } from '../schema.ts'
import { parseDateRange, type FilterValues } from '../shared/list_filters.ts'
import { columnName } from './list_records.ts'

/**
 * The filters this user may use (FR-13): all of the resource's, except
 * a `belongsTo` filter whose related resource the user can't list
 * (`viewList`, failing closed, as for `belongsTo` fields). Its URL
 * parameter is then ignored, and its options endpoint answers 403.
 */
export async function usableFilters(
  ctx: HttpContext,
  context: RelationsContext,
  resource: Resource<any, any>
): Promise<FilterSchema[]> {
  const usable: FilterSchema[] = []
  for (const filter of resource.toSchema().filters) {
    if (
      filter.kind === 'belongsTo' &&
      !(await canListRelated(ctx, context, resource.model, filter))
    ) {
      continue
    }
    usable.push(filter)
  }
  return usable
}

/**
 * The related records the `belongsTo` filters point at, found through
 * the related resource's `query` hook. A key that matches no record
 * (or one outside that scope, or one the key's type can't hold) turns
 * its filter off, so the list never filters by a record the user
 * can't see.
 */
export async function selectedRelations(
  context: RelationsContext,
  resource: Resource<any, any>,
  filters: FilterSchema[],
  values: FilterValues
): Promise<{ values: FilterValues; selected: Record<string, RelationOption> }> {
  const kept = { ...values }
  const selected: Record<string, RelationOption> = {}
  for (const filter of filters) {
    const value = values[filter.name]
    if (filter.kind !== 'belongsTo' || value === undefined) continue
    const keys = relationKeys(resource.model, filter.name)
    const related = keys ? context.azu.resources.forModel(keys.related) : undefined
    if (!keys || !related) {
      delete kept[filter.name]
      continue
    }

    const query = keys.related.query()
    related.options.query?.(query)
    const record = await firstByKey(query, keys.localKeyColumnName, value)
    if (!record) {
      delete kept[filter.name]
      continue
    }
    selected[filter.name] = {
      id: record.$primaryKeyValue as string | number,
      title: titleOf(record, related.options.title ?? null),
    }
  }
  return { values: kept, selected }
}

/**
 * What the list page needs for each usable filter: its schema, its
 * value, the selected record for `belongsTo`, and its options URL.
 */
export function listFilters(
  filters: FilterSchema[],
  values: FilterValues,
  selected: Record<string, RelationOption>,
  resourcePath: string
): ListFilter[] {
  return filters.map((filter) => ({
    ...filter,
    value: values[filter.name] ?? null,
    selected: selected[filter.name] ?? null,
    optionsUrl:
      filter.kind === 'belongsTo'
        ? `${resourcePath}/filters/${encodeURIComponent(filter.name)}/options`
        : null,
  }))
}

function pad(value: number, length = 2) {
  return String(value).padStart(length, '0')
}

/**
 * An instant as the database column holds it. Lucid writes a datetime
 * with the dialect's `dateTimeFormat`, in the server process's
 * timezone: wall-clock time, with the offset on Postgres. Comparing in
 * the same form matches what Lucid stored.
 */
export function databaseDateTime(
  instant: number,
  dateTimeFormat: string,
  zone = processTimezone()
): string {
  const clock = wallClockAt(instant, zone)
  const date = `${pad(clock.year, 4)}-${pad(clock.month)}-${pad(clock.day)}`
  const time = `${pad(clock.hour)}:${pad(clock.minute)}:${pad(clock.second)}`
  if (!dateTimeFormat.includes('Z')) return `${date} ${time}`
  const minutes = Math.round(offsetAt(instant, zone) / 60_000)
  const sign = minutes < 0 ? '-' : '+'
  const offset = `${sign}${pad(Math.floor(Math.abs(minutes) / 60))}:${pad(Math.abs(minutes) % 60)}`
  return `${date}T${time}.000${offset}`
}

/**
 * Midnight at the start of a date in a timezone, as an instant.
 */
export function startOfDay(date: string, timezone: string, addDays = 0): number {
  const [year, month, day] = date.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day + addDays))
  return instantOf(
    {
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth() + 1,
      day: shifted.getUTCDate(),
      hour: 0,
      minute: 0,
      second: 0,
    },
    timezone
  )
}

/**
 * Narrows a list query by the filters that are on. Values come from
 * `parseListState`, so they already fit their filter.
 *
 * A `dateRange` on a `date` column compares dates. On a datetime column
 * it covers whole days in the admin's timezone: from midnight on the
 * first day up to (not including) midnight after the last.
 */
export function applyFilters(
  query: ModelQueryBuilderContract<LucidModel>,
  resource: Resource<any, any>,
  values: FilterValues,
  options: { timezone: string }
) {
  const model: LucidModel = resource.model
  for (const filter of resource.filters()) {
    const value = values[filter.name]
    if (value === undefined) continue

    switch (filter.kind) {
      case 'select':
        query.where(columnName(model, filter.name), value)
        break
      case 'boolean':
        query.where(columnName(model, filter.name), value === 'true')
        break
      case 'belongsTo': {
        const keys = relationKeys(model, filter.name)
        if (keys) query.where(keys.foreignKeyColumnName, value)
        break
      }
      case 'dateRange': {
        const range = parseDateRange(value)
        if (!range) break
        const column = columnName(model, filter.name)
        const meta = model.$getColumn(filter.name)?.meta as { type?: string } | undefined
        if (meta?.type === 'date') {
          if (range.from) query.where(column, '>=', range.from)
          if (range.to) query.where(column, '<=', range.to)
          break
        }
        const format = query.client.dialect.dateTimeFormat
        if (range.from) {
          query.where(
            column,
            '>=',
            databaseDateTime(startOfDay(range.from, options.timezone), format)
          )
        }
        if (range.to) {
          query.where(
            column,
            '<',
            databaseDateTime(startOfDay(range.to, options.timezone, 1), format)
          )
        }
        break
      }
      case 'custom':
        filter.apply?.(query as never)
        break
    }
  }
}
