/**
 * The resource schema Azu sends to the front end. Plain JSON, defined
 * here rather than in a front-end package, so React and a future Vue
 * package render from the same contract. Absent values are `null`,
 * never `undefined`, so the schema survives serialisation unchanged.
 */
import type { NumberFormat } from './shared/format.ts'
import type { Comparison } from './shared/metrics.ts'
import type { SlotName } from './shared/slots.ts'

export type ColumnKind =
  | 'text'
  | 'number'
  | 'decimal'
  | 'boolean'
  | 'badge'
  | 'image'
  | 'date'
  | 'datetime'
  | 'belongsTo'
  | 'custom'

export type ColumnSchema = {
  kind: ColumnKind
  /** The model attribute, or the relation for `belongsTo` */
  name: string
  label: string
  sortable: boolean
  hiddenByDefault: boolean
  /** A component registered from `inertia/admin/components` */
  component: string | null
  /** `number` and `decimal` */
  format: { style: 'currency' | 'percent'; currency: string | null } | null
  /** `badge`: value → colour name */
  colors: Record<string, string> | null
  /** `belongsTo`: the related model's attribute to show */
  relationTitle: string | null
  /**
   * Value → label, from the resource's `select` field of the same name
   * (`published` → "Published"), so a status badge reads like the form
   */
  labels: Record<string, string> | null
}

export type FieldKind =
  | 'text'
  | 'textarea'
  | 'number'
  | 'decimal'
  | 'boolean'
  | 'select'
  | 'date'
  | 'datetime'
  | 'richText'
  | 'file'
  | 'image'
  | 'belongsTo'
  | 'hasMany'
  | 'manyToMany'

export type FieldSchema = {
  kind: FieldKind
  /** The model attribute, or the relation for relation fields */
  name: string
  label: string
  help: string | null
  placeholder: string | null
  default: string | number | boolean | null
  visibleOn: 'create' | 'edit' | null
  readOnly: boolean
  /** A policy method gating the field */
  ability: string | null
  component: string | null
  /** `number` and `decimal`. Decimal bounds stay exact strings */
  min: number | string | null
  max: number | string | null
  step: number | string | null
  /**
   * `text`. On a form, a `number` or `decimal` field without one shows
   * the currency of its list column (`NGN`)
   */
  prefix: string | null
  suffix: string | null
  /** `select`: value → label */
  options: Record<string, string> | null
  /** `file` and `image` */
  disk: string | null
  maxSize: string | null
  /** `file` and `image`: accepted MIME types, e.g. `image/*`, `application/pdf` */
  accept: string[] | null
  /** Relation fields: the related model's attribute to search and show */
  searchable: string | null
}

export type FilterKind = 'select' | 'boolean' | 'dateRange' | 'belongsTo' | 'custom'

export type FilterSchema = {
  kind: FilterKind
  /** The URL query parameter */
  name: string
  label: string
  /** `select`: value → label */
  options: Record<string, string> | null
}

export type ActionSchema = {
  kind: 'row' | 'bulk'
  name: string
  label: string
  confirm: string | null
  /** The policy method each record must pass (`update` unless the action names one) */
  ability: string
  /** Styled as destructive, like the built-in Delete */
  destructive: boolean
  /** The dialog's fields, with hints from the action's validator */
  fields: FormFieldSchema[]
}

/**
 * An action's key in `abilities.actions`: `row.publish`, `bulk.delete`.
 */
export type ActionKey = `${'row' | 'bulk'}.${string}`

/**
 * What the action endpoint returns.
 */
export type ActionResponse = {
  /** For a toast */
  message: string | null
  /** Where to go next, instead of staying on the page */
  redirect: string | null
  /** Records the action ran on */
  done: number
  /**
   * Records skipped because the user may not run the action on them, or,
   * in a run on all matching rows, because they no longer matched when
   * their chunk ran
   */
  skipped: number
  /**
   * A run on all matching rows (FR-17) that stopped at a failed chunk:
   * the records left unchanged, in that chunk and the ones after it.
   * Chunks before it stay committed. Otherwise 0
   */
  failed: number
}

export type ResourceSchema = {
  /** URL name, e.g. `products` */
  name: string
  label: string
  singularLabel: string
  group: string | null
  icon: string | null
  /** The attribute that names a record */
  title: string | null
  search: string[]
  columns: ColumnSchema[]
  fields: FieldSchema[]
  filters: FilterSchema[]
  actions: ActionSchema[]
  /** Slot → the app component rendered there, by registered name (FR-15) */
  slots: Record<SlotName, string | null>
}

export type NavigationItem = {
  /** A resource, a custom screen (FR-20), or a link (FR-21) */
  kind: 'resource' | 'screen' | 'link'
  name: string
  label: string
  icon: string | null
  href: string
  /**
   * An absolute `http(s)` link: it opens in a new tab, with an
   * external-link icon
   */
  external: boolean
}

/**
 * A custom screen (FR-20), as its page and the navigation see it.
 */
export type ScreenSchema = {
  /** From its file: `sales_report.ts` → `sales-report` */
  name: string
  label: string
  group: string | null
  icon: string | null
  /** The registered component that renders it; `null` for a form or widgets screen */
  component: string | null
  /** A form Azu renders (FR-23), instead of a component */
  form: boolean
  /** Widgets Azu renders (FR-24), instead of a component */
  widgets: boolean
}

/**
 * A widget on a widgets screen (FR-24), as the page lists it before
 * its data loads. Only the widgets the user may see are listed.
 */
export type WidgetSchema = {
  /** The page prop its data arrives in, `widget0` */
  key: string
  kind: 'value' | 'progress' | 'partition' | 'table' | 'trend'
  label: string
  /** Grid columns it spans, of 4 */
  width: 1 | 2 | 3 | 4
  format: NumberFormat
  /** Said under the label: "All time" for a widget without a date column */
  note: string | null
  /** Whether it's compared with the previous period */
  compares: boolean
  /** Which way is good: `lower` for cancellations, refunds, response times */
  better: 'higher' | 'lower'
}

/** One bucket of a trend widget (FR-25) */
export type TrendBucket = {
  /** Where the bucket starts and ends, as ISO instants in the admin's timezone */
  start: string
  end: string
  /** An exact decimal string; 0 for an empty bucket */
  value: string
  /** The previous period's bucket at the same position, with `compare()` */
  previous: string | null
  /** Where that previous bucket starts and ends, to name it ("Wed 16 Sep"); `null` without one */
  previousStart: string | null
  previousEnd: string | null
  /** The list filtered to this day, week or month; `null` for hours */
  href: string | null
}

/** A partition widget's row */
export type PartitionRow = {
  /** The grouped value; `null` for "Other" and for empty values */
  key: string | null
  label: string
  /** A count or total, as an exact decimal string */
  value: string
  /** Of the largest row, 0 to 1, for the bar */
  share: number
  /** Of all rows, 0 to 1 */
  percent: number
  /** The filtered list, when the resource has a select filter on the column */
  href: string | null
}

/**
 * A widget's data, in its own page prop. `error` when it couldn't load:
 * the error is logged on the server and the card says so.
 */
export type WidgetData =
  | {
      status: 'error'
      /** Why, when it's something the user can act on (a trend's range too long) */
      message?: string
    }
  | {
      status: 'ok'
      kind: 'value'
      /** An exact decimal string */
      value: string
      previous: string | null
      comparison: Comparison | null
      href: string | null
    }
  | {
      status: 'ok'
      kind: 'progress'
      value: string
      goal: string
      /** Of the goal, from 0; above 1 once it's passed */
      share: number
      /** How far through the period now is, 0 to 1 */
      pace: number
      /** The period's name: "October 2026", "Q4 2026", "Week of Oct 19" */
      period: string
      /** Milliseconds until the period ends */
      remaining: number
    }
  | {
      status: 'ok'
      kind: 'partition'
      rows: PartitionRow[]
      /** All rows together, as an exact decimal string */
      total: string
      /** What's counted, for "386 orders"; `null` for a total */
      unit: { one: string; other: string } | null
    }
  | {
      status: 'ok'
      kind: 'trend'
      /** What each bucket covers: an hour, a day, a week (from Monday) or a month */
      unit: 'hour' | 'day' | 'week' | 'month'
      chart: 'line' | 'bars'
      buckets: TrendBucket[]
      /** All buckets together, as an exact decimal string */
      total: string
      /** The previous period's total, with `compare()`; else `null` */
      previousTotal: string | null
      /** What's counted, lower case, for "No orders in this range" */
      noun: string
    }
  | {
      status: 'ok'
      kind: 'table'
      /** The resource's URL name, for row links */
      resource: string
      columns: ColumnSchema[]
      titleColumn: string | null
      rows: ListRow[]
      /** How many records match, for "View all 6" */
      total: number
      href: string | null
    }

export type NavigationGroup = {
  /** `null` for items without a group */
  label: string | null
  items: NavigationItem[]
}

/**
 * One list cell, by column kind. Decimals stay exact strings; dates are
 * ISO strings; `belongsTo` gives the related record's id and title.
 */
export type CellValue =
  | string
  | number
  | boolean
  | null
  | { id: string | number; title: string | null }
  | { url: string | null }

export type ListRow = {
  /** The record's primary key */
  id: string | number
  /** The resource's `title` attribute, for accessible row labels */
  title: string | null
  /** Keyed by column name */
  cells: Record<string, CellValue>
  /** What the user may do with this record, from the policy */
  abilities: {
    /** The policy's `view` for this record: its detail page */
    view: boolean
    /** The policy's `update` for this record: its edit form */
    update: boolean
    /** Actions the user may run on this record (`row.publish`, `bulk.delete`) */
    actions: ActionKey[]
  }
}

/**
 * A filter as the list page shows it (FR-13): its schema, its value
 * from the URL, and for `belongsTo` the selected record and the
 * policy-checked options endpoint.
 */
export type ListFilter = FilterSchema & {
  /** The URL value, or `null` when the filter is off */
  value: string | null
  /** `belongsTo`: the record the value names */
  selected: RelationOption | null
  /** `belongsTo`: `GET` it with `?search=` for options */
  optionsUrl: string | null
}

export type ListMeta = {
  /** Rows the search and filters match */
  total: number
  /** Rows without the search and filters; `null` when neither is on */
  unfilteredTotal: number | null
  perPage: number
  currentPage: number
  lastPage: number
}

/**
 * A related record, as a `belongsTo` field shows it: its key, its
 * title, and its detail page when the user may open it.
 */
export type RelationValue = {
  /** Lucid localKey (belongsTo) or relatedKey (manyToMany), not necessarily the primary key */
  id: string | number
  title: string | null
  /** `null` without a resource for the related model, or without `view` */
  href: string | null
}

/**
 * A stored upload, as `file` and `image` fields show it.
 */
export type FileValue = {
  /** The Drive key */
  key: string
  /** The file name, from the key */
  name: string
  /** From the disk; `null` when it can't make one */
  url: string | null
}

/**
 * A form or detail value, by field kind. Decimals stay exact strings;
 * dates are `YYYY-MM-DD`; datetimes are ISO strings with an offset;
 * `belongsTo` is the related record; `file` and `image` the stored upload.
 */
export type FieldValue =
  | string
  | number
  | boolean
  | null
  | RelationValue
  /** A `manyToMany` field's attached records */
  | RelationValue[]
  | FileValue

/**
 * A field as a form renders it: the resource's field, with hints from
 * the operation's VineJS validator. Explicit field hints (`min`, `max`,
 * `step`, `options`) win over the validator's, for the UI only.
 */
export type FormFieldSchema = FieldSchema & {
  /**
   * The payload key the form submits and validation errors use: the
   * field name, or a `belongsTo` field's foreign key (`category` →
   * `categoryId`)
   */
  input: string
  /** `belongsTo` and `manyToMany`: where the picker searches for options */
  optionsUrl: string | null
  /**
   * Why the form shows the field read-only, shown under it: a
   * `manyToMany` field with attachments outside its scope or beyond its load limit
   */
  readOnlyReason: string | null
  /** Not optional and not nullable in the validator, with no conditional rule */
  required: boolean
  minLength: number | null
  maxLength: number | null
}

/**
 * Validation messages keyed by field path, as VineJS reports them:
 * `name`, `variants.1.sku`, `tags.0`.
 */
export type FormErrors = Record<string, string[]>

/**
 * A record as the detail and edit pages see it.
 */
export type RecordData = {
  id: string | number
  /** The resource's `title` attribute */
  title: string | null
  /** Keyed by field name */
  values: Record<string, FieldValue>
}

/**
 * One option in a `belongsTo` select.
 */
export type RelationOption = {
  /** Lucid localKey (belongsTo) or relatedKey (manyToMany), not necessarily the primary key */
  id: string | number
  title: string | null
}

/**
 * A `hasMany` field on the detail page: one page of the related
 * records, shown with the related resource's columns.
 */
export type RelationTable = {
  /** The field (relation) name */
  name: string
  label: string
  /** The related resource's URL name */
  resource: string
  columns: ColumnSchema[]
  /** The related resource's title attribute */
  titleColumn: string | null
  rows: ListRow[]
  meta: ListMeta
  /** The query parameter holding this table's page, e.g. `productsPage` */
  pageParam: string
}
