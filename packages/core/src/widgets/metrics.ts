import type { HttpContext } from '@adonisjs/core/http'
import type { BouncerAbility } from '@adonisjs/bouncer/types'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import type { DateTime } from 'luxon'
import type { Column } from '../resources/columns.ts'
import type { Resource } from '../resources/define_resource.ts'
import type { ColumnName, DateColumn, NumberColumn } from '../resources/model_types.ts'
import type { NumberFormat } from '../shared/format.ts'
import type { Better, BucketUnit, Period, RangeName } from '../shared/metrics.ts'

/** Any resource, with its model, policy and columns */
export type AnyResource = Resource<any, any, any>

/** The model behind a resource */
export type ModelOf<R> = R extends Resource<infer M, any, any> ? M : never

/** A resource's declared columns, type-level only */
type ColumnsOf<R> = R extends Resource<any, any, infer C> ? C : never
type DecimalNames<C> = C extends Column<'decimal', infer N, any, any> ? N : never
type ColumnNames<C> = C extends Column<any, infer N, any, any> ? N : never

/**
 * Columns `sum`, `avg`, `min` and `max` take: number columns, and the
 * columns the resource lists as `column.decimal()` (decimals are typed
 * `string` on the model, like text, so the resource is what says a
 * column holds numbers). Persisted columns only, since it's SQL.
 */
export type NumericColumnOf<R> =
  NumberColumn<ModelOf<R>> | (DecimalNames<ColumnsOf<R>> & ColumnName<ModelOf<R>>)

/** Date and datetime columns of a resource's model */
export type DateColumnOf<R> = DateColumn<ModelOf<R>>

/** Any persisted column of a resource's model */
export type ColumnOf<R> = ColumnName<ModelOf<R>>

/** The names of a resource's list columns */
export type ListColumnOf<R> = ColumnNames<ColumnsOf<R>>

export type Aggregate = 'count' | 'sum' | 'avg' | 'min' | 'max'

export type WidgetKind = 'value' | 'progress' | 'partition' | 'table' | 'trend'

/** Grid columns a widget spans, of 4 */
export type WidgetWidth = 1 | 2 | 3 | 4

/**
 * Filter values for a widget's link, keyed by the resource's filter
 * names: a select's value, `true` or `false` for a boolean, `true` for a
 * custom filter, `from..to` for a date range.
 */
export type LinkFilters = Record<string, string | number | boolean>

/** The range a `using()` widget is computed for */
export type MetricRange = { name: RangeName; start: DateTime; end: DateTime }

/** A `using()` widget's function: the value for a range */
export type MetricFn = (
  ctx: HttpContext,
  range: MetricRange
) => number | string | Promise<number | string>

/** A goal, or a function of the request that gives one */
export type Goal = number | ((ctx: HttpContext) => number | Promise<number>)

type Where<R> = (query: ModelQueryBuilderContract<ModelOf<R>>) => unknown

/**
 * What a widget holds, read by the server. Builder methods set it.
 */
export type WidgetState = {
  kind: WidgetKind
  label: string
  resource: AnyResource | null
  aggregate: Aggregate | null
  column: string | null
  where: ((query: ModelQueryBuilderContract<any>) => unknown) | null
  dateColumn: string | null
  format: NumberFormat
  /** Whether figures are abbreviated; `null` from 1,000,000 up */
  compact: boolean | null
  link: LinkFilters | null
  compare: boolean
  /** Which way a value widget's comparison is good */
  better: Better
  width: WidgetWidth | null
  using: MetricFn | null
  ability: BouncerAbility<any> | null
  period: Period
  goal: Goal | null
  groupBy: string | null
  limit: number | null
  orderBy: { column: string; direction: 'asc' | 'desc' } | null
  columns: string[] | null
  /** A trend's bucket; `null` follows the range */
  bucket: BucketUnit | null
  /** How a trend draws */
  chart: 'line' | 'bars'
}

const WIDGET = Symbol.for('mezielabs.azu.widget')

/**
 * A widget on a screen (FR-24). Built with `metric.value()`,
 * `metric.progress()`, `metric.partition()` or `metric.table()`.
 */
export class Widget<Kind extends WidgetKind = WidgetKind, R = AnyResource> {
  readonly [WIDGET] = true
  /** Type-only: the resource the widget reads */
  declare readonly __resource: R

  readonly state: WidgetState

  constructor(state: Partial<WidgetState> & { kind: Kind; label: string }) {
    this.state = {
      resource: null,
      aggregate: null,
      column: null,
      where: null,
      dateColumn: null,
      format: null,
      compact: null,
      link: null,
      compare: true,
      better: 'higher',
      width: null,
      using: null,
      ability: null,
      period: 'month',
      goal: null,
      groupBy: null,
      limit: null,
      orderBy: null,
      columns: null,
      bucket: null,
      chart: 'line',
      ...state,
    }
  }

  static isWidget(value: unknown): value is Widget {
    return typeof value === 'object' && value !== null && WIDGET in value
  }

  get kind(): Kind {
    return this.state.kind as Kind
  }

  protected set<K extends keyof WidgetState>(key: K, value: WidgetState[K]): this {
    this.state[key] = value
    return this
  }

  /** How many of the grid's 4 columns it spans. One column on phones. */
  width(columns: WidgetWidth): this {
    return this.set('width', columns)
  }
}

/**
 * What resource-backed widgets share: a `where()` on the resource's
 * query, and a `date()` column the range applies to.
 */
class ResourceWidget<Kind extends WidgetKind, R> extends Widget<Kind, R> {
  /**
   * Narrows the query, after the resource's own `query` hook, so a
   * widget never counts records its user couldn't list.
   */
  where(callback: Where<R>): this {
    return this.set('where', callback as WidgetState['where'])
  }

  /**
   * The column the screen's range applies to. Without one, the widget is
   * all-time and ignores the range.
   */
  date(column: DateColumnOf<R>): this {
    return this.set('dateColumn', column as string)
  }
}

/** Number formatting for a value, as list columns take it */
type FormatStyle = 'currency' | 'percent'

/**
 * A single figure (FR-24), compared with the previous period when it has
 * a `date()`.
 */
export class ValueWidget<R> extends ResourceWidget<'value', R> {
  /**
   * Abbreviates its figures ("NGN 194K"), or with `compact(false)` never
   * does. By default, figures from 1,000,000 up are ("NGN 4.28M"). The
   * exact figure stays in the tooltip and for screen readers.
   */
  compact(enabled = true): this {
    return this.set('compact', enabled)
  }

  /** Formats the value: `format('currency', 'NGN')` or `format('percent')` */
  format(style: FormatStyle, currency?: string): this {
    return this.set('format', { style, currency: currency ?? null })
  }

  /**
   * Links the figure to the resource's list, filtered by `filters` (the
   * resource's own filter names) and by the range, when the resource
   * has a `dateRange` filter on the `date()` column.
   */
  link(filters: LinkFilters = {}): this {
    return this.set('link', filters)
  }

  /** `compare(false)` turns off the comparison with the previous period */
  compare(enabled: boolean): this {
    return this.set('compare', enabled)
  }

  /**
   * For figures where down is good (cancellations, refunds, response
   * times): a decrease reads as better. The arrow still shows the real
   * direction.
   */
  lowerIsBetter(): this {
    return this.set('better', 'lower')
  }
}

/**
 * A figure from your own function (FR-24): no resource, so no automatic
 * access check or scoping. It needs `ability()`.
 */
export class CustomValueWidget<HasAbility extends boolean = false> extends Widget<'value', never> {
  declare readonly __hasAbility: HasAbility

  /** Who sees it: a Bouncer ability object, checked on every request */
  ability(ability: BouncerAbility<any>): CustomValueWidget<true> {
    this.set('ability', ability)
    return this as unknown as CustomValueWidget<true>
  }

  /**
   * Abbreviates its figures ("NGN 194K"), or with `compact(false)` never
   * does. By default, figures from 1,000,000 up are ("NGN 4.28M"). The
   * exact figure stays in the tooltip and for screen readers.
   */
  compact(enabled = true): this {
    return this.set('compact', enabled)
  }

  format(style: FormatStyle, currency?: string): this {
    return this.set('format', { style, currency: currency ?? null })
  }

  /**
   * `compare(false)` turns off the comparison. Otherwise the function is
   * called again for the previous period.
   */
  compare(enabled: boolean): this {
    return this.set('compare', enabled)
  }

  /** For figures where down is good: a decrease reads as better */
  lowerIsBetter(): this {
    return this.set('better', 'lower')
  }
}

/**
 * A figure against a goal over a period (FR-24): this month to date by
 * default, in the admin's timezone, not the screen's range.
 */
export class ProgressWidget<R> extends ResourceWidget<'progress', R> {
  /** The period: day, week, month, quarter or year, to date */
  period(period: Period): this {
    return this.set('period', period)
  }

  /** The goal: a number, or a function of the request */
  goal(goal: Goal): this {
    return this.set('goal', goal)
  }

  /**
   * Abbreviates its figures ("NGN 194K"), or with `compact(false)` never
   * does. By default, figures from 1,000,000 up are ("NGN 4.28M"). The
   * exact figure stays in the tooltip and for screen readers.
   */
  compact(enabled = true): this {
    return this.set('compact', enabled)
  }

  format(style: FormatStyle, currency?: string): this {
    return this.set('format', { style, currency: currency ?? null })
  }
}

/**
 * A count or total per value of a column (FR-24), as bars.
 */
export class PartitionWidget<R> extends ResourceWidget<'partition', R> {
  /**
   * The column to group by. Labels come from the resource's select field
   * or badge column, else the value in sentence case.
   */
  groupBy(column: ColumnOf<R>): this {
    return this.set('groupBy', column as string)
  }

  /** Rows shown; the rest fold into "Other". Default 5. */
  limit(rows: number): this {
    return this.set('limit', rows)
  }

  /**
   * Abbreviates its figures ("NGN 194K"), or with `compact(false)` never
   * does. By default, figures from 1,000,000 up are ("NGN 4.28M"). The
   * exact figure stays in the tooltip and for screen readers.
   */
  compact(enabled = true): this {
    return this.set('compact', enabled)
  }

  format(style: FormatStyle, currency?: string): this {
    return this.set('format', { style, currency: currency ?? null })
  }

  /**
   * Extra list filters for the rows' links. Rows link to the resource's
   * list filtered by their value when it has a select filter on the
   * `groupBy()` column.
   */
  link(filters: LinkFilters = {}): this {
    return this.set('link', filters)
  }
}

/**
 * A few of a resource's records (FR-24), with its columns and links.
 */
export class TableWidget<R> extends ResourceWidget<'table', R> {
  /** Newest first, by a column */
  latest(column: ColumnOf<R>): this {
    return this.set('orderBy', { column: column as string, direction: 'desc' })
  }

  /** In order of a column */
  orderBy(column: ColumnOf<R>, direction: 'asc' | 'desc' = 'asc'): this {
    return this.set('orderBy', { column: column as string, direction })
  }

  /** Rows shown. Default 5. */
  limit(rows: number): this {
    return this.set('limit', rows)
  }

  /** A subset of the resource's list columns, in this order */
  columns(names: ListColumnOf<R>[]): this {
    return this.set('columns', names as string[])
  }

  /** A "View all" link to the resource's list, filtered by `filters` */
  link(filters: LinkFilters = {}): this {
    return this.set('link', filters)
  }
}

/**
 * A figure over time (FR-25), counted in buckets: hours, days, weeks or
 * months in the admin's timezone, drawn as a line or bars. `date()` is
 * required: without it, a trend has nothing to count along, so it isn't
 * a widget a screen takes (`HasDate`).
 */
export class TrendWidget<R, HasDate extends boolean = false> extends Widget<'trend', R> {
  declare readonly __hasDate: HasDate

  constructor(state: Partial<WidgetState> & { kind: 'trend'; label: string }) {
    // Off unless asked for: a second line is a choice, not a default
    super({ compare: false, ...state })
  }

  /** Narrows the query, after the resource's own `query` hook */
  where(callback: Where<R>): this {
    return this.set('where', callback as WidgetState['where'])
  }

  /** The date or datetime column the buckets count along. Required. */
  date(column: DateColumnOf<R>): TrendWidget<R, true> {
    this.set('dateColumn', column as string)
    return this as unknown as TrendWidget<R, true>
  }

  /**
   * The bucket: `hour`, `day`, `week` (from Monday) or `month`. Without
   * it, the bucket follows the range: hours today, days up to 90 days,
   * weeks for a quarter, months for a year.
   */
  by(unit: BucketUnit): this {
    return this.set('bucket', unit)
  }

  /** Bars instead of a line */
  bars(): this {
    return this.set('chart', 'bars')
  }

  /** The previous period too, as a second, muted line */
  compare(enabled = true): this {
    return this.set('compare', enabled)
  }

  format(style: FormatStyle, currency?: string): this {
    return this.set('format', { style, currency: currency ?? null })
  }

  /** For figures where down is good: a fall reads as better */
  lowerIsBetter(): this {
    return this.set('better', 'lower')
  }
}

/**
 * The aggregates a value, progress or partition widget starts from.
 */
class Aggregates<W extends 'value' | 'progress' | 'partition' | 'trend'> {
  constructor(
    protected kind: W,
    protected label: string
  ) {}

  protected make<R>(resource: R, aggregate: Aggregate, column: string | null): Built<W, R> {
    const Class = {
      value: ValueWidget,
      progress: ProgressWidget,
      partition: PartitionWidget,
      trend: TrendWidget,
    }[this.kind] as new (
      state: Partial<WidgetState> & { kind: WidgetKind; label: string }
    ) => Widget
    return new Class({
      kind: this.kind,
      label: this.label,
      resource: resource as AnyResource,
      aggregate,
      column,
    }) as unknown as Built<W, R>
  }

  /** How many records */
  count<R extends AnyResource>(resource: R): Built<W, R> {
    return this.make(resource, 'count', null)
  }

  /** The total of a number or decimal column */
  sum<R extends AnyResource>(resource: R, column: NumericColumnOf<R>): Built<W, R> {
    return this.make(resource, 'sum', column as string)
  }

  /** The average, rounded to the column's scale (2 places for numbers) */
  avg<R extends AnyResource>(resource: R, column: NumericColumnOf<R>): Built<W, R> {
    return this.make(resource, 'avg', column as string)
  }

  min<R extends AnyResource>(resource: R, column: NumericColumnOf<R>): Built<W, R> {
    return this.make(resource, 'min', column as string)
  }

  max<R extends AnyResource>(resource: R, column: NumericColumnOf<R>): Built<W, R> {
    return this.make(resource, 'max', column as string)
  }
}

type Built<W, R> = W extends 'value'
  ? ValueWidget<R>
  : W extends 'progress'
    ? ProgressWidget<R>
    : W extends 'trend'
      ? TrendWidget<R, false>
      : PartitionWidget<R>

class ValueAggregates extends Aggregates<'value'> {
  /**
   * A value from your own function, called with the request and the
   * range. Needs `ability()`: there's no resource to check.
   */
  using(fn: MetricFn): CustomValueWidget<false> {
    return new CustomValueWidget({ kind: 'value', label: this.label, using: fn })
  }
}

/**
 * Widget builders for screens (FR-24). Resource-backed widgets take the
 * resource from `app/admin/resources`, so columns are typed against its
 * model, and show only to users who may list it.
 *
 * @example
 * ```ts
 * metric.value('Revenue').sum(orders, 'total').date('placedAt').format('currency', 'NGN')
 * metric.partition('Orders by status').count(orders).groupBy('status').date('placedAt')
 * metric.table('Recent orders').resource(orders).latest('placedAt').limit(5)
 * ```
 */
export const metric = {
  /** A single figure, compared with the previous period */
  value: (label: string) => new ValueAggregates('value', label),
  /** A figure against a goal */
  progress: (label: string) => new Aggregates('progress', label),
  /** A figure over time, in buckets (FR-25): needs `date()` */
  trend: (label: string) => new Aggregates('trend', label),
  /** A figure per value of a column */
  partition: (label: string) => new Aggregates('partition', label),
  /** A few records */
  table: (label: string) => ({
    resource: <R extends AnyResource>(resource: R): TableWidget<R> =>
      new TableWidget<R>({ kind: 'table', label, resource }),
  }),
}

/**
 * The widgets a screen takes: resource-backed ones, and `using()` ones
 * with an `ability()`.
 */
export type ScreenWidget =
  | ValueWidget<any>
  | ProgressWidget<any>
  | PartitionWidget<any>
  | TableWidget<any>
  | CustomValueWidget<true>
  | TrendWidget<any, true>
