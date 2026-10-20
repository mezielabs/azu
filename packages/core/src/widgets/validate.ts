import { RANGE_NAMES, isRangeName } from '../shared/metrics.ts'
import { linkFilterValue } from './compute.ts'
import { Widget, type WidgetState } from './metrics.ts'

/**
 * What's wrong with a widget, as messages that name it (FR-24): a
 * `date()` column that isn't a date or datetime, `link()` filters the
 * resource doesn't have or values they don't take, and widgets missing
 * what their kind needs. Boot fails on any of them; `azu:doctor`
 * reports them too.
 */
export function widgetProblems(state: WidgetState): string[] {
  const problems: string[] = []
  const name = `the "${state.label}" widget`

  if (!state.resource) {
    if (!state.using) problems.push(`${name} needs a resource or using()`)
    if (!state.ability) {
      problems.push(
        `${name} uses using() without an ability: there's no resource to check access with, so add .ability()`
      )
    }
    return problems
  }

  const { resource } = state
  const model = resource.model
  if (state.dateColumn) {
    const type = (model.$getColumn(state.dateColumn)?.meta as { type?: string } | undefined)?.type
    if (type !== 'date' && type !== 'datetime') {
      problems.push(
        `${name}'s date() column, "${state.dateColumn}", isn't a date or datetime column on ${model.name}`
      )
    }
  }
  for (const [filter, value] of Object.entries(state.link ?? {})) {
    if (!resource.filters().some((item) => item.name === filter)) {
      const names = resource.filters().map((item) => item.name)
      problems.push(
        `${name} links with the "${filter}" filter, which the "${resource.name}" resource doesn't have` +
          (names.length ? ` (it has ${names.join(', ')})` : '')
      )
    } else if (linkFilterValue(resource, filter, value) === null) {
      problems.push(`${name} links with ${filter}=${String(value)}, which that filter doesn't take`)
    }
  }
  if (state.kind === 'partition' && !state.groupBy) {
    problems.push(`${name} needs groupBy(): the column to break down by`)
  }
  if (state.kind === 'progress') {
    if (!state.dateColumn) problems.push(`${name} needs date(): the column its period applies to`)
    if (state.goal === null) problems.push(`${name} needs goal()`)
  }
  if (state.limit !== null && (!Number.isInteger(state.limit) || state.limit < 1)) {
    problems.push(`${name}'s limit() must be a whole number of rows, 1 or more`)
  }
  return problems
}

/**
 * A widgets screen's shape (FR-24), checked at boot: widgets made with
 * `metric`, each without problems, no `data` beside them, and ranges
 * Azu knows.
 */
export function assertWidgets(
  label: string,
  options: { widgets: unknown; ranges?: unknown; data?: unknown }
) {
  if (options.data !== undefined) {
    throw new Error(`The "${label}" screen has widgets and "data": widgets load their own data`)
  }
  if (!Array.isArray(options.widgets) || options.widgets.length === 0) {
    throw new Error(`The "${label}" screen's "widgets" needs at least one widget`)
  }
  for (const item of options.widgets as unknown[]) {
    if (!Widget.isWidget(item)) {
      throw new Error(
        `The "${label}" screen's widgets must be made with metric.value() and the like`
      )
    }
    const problems = widgetProblems(item.state)
    if (problems.length > 0) throw new Error(`The "${label}" screen: ${problems[0]}`)
  }
  if (options.ranges !== undefined) {
    const ranges = options.ranges as unknown[]
    if (!Array.isArray(ranges) || ranges.length === 0) {
      throw new Error(`The "${label}" screen's "ranges" needs at least one range`)
    }
    const unknown = ranges.find((range) => !isRangeName(range))
    if (unknown !== undefined) {
      throw new Error(
        `The "${label}" screen's ranges include "${String(unknown)}"; ranges are ${RANGE_NAMES.join(', ')}`
      )
    }
  }
}
