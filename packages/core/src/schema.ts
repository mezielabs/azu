/**
 * The resource schema Azu sends to the front end. Plain JSON, defined
 * here rather than in a front-end package, so React and a future Vue
 * package render from the same contract. Absent values are `null`,
 * never `undefined`, so the schema survives serialisation unchanged.
 */

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
  /** `text` */
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
  /** Records skipped because the user may not run the action on them */
  skipped: number
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
}

export type NavigationItem = {
  name: string
  label: string
  icon: string | null
  href: string
}

export type NavigationGroup = {
  /** `null` for resources without a group */
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
    view: boolean
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
  total: number
  perPage: number
  currentPage: number
  lastPage: number
}

/**
 * A related record, as a `belongsTo` field shows it: its key, its
 * title, and its detail page when the user may open it.
 */
export type RelationValue = {
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
   * `manyToMany` field with more records attached than the form loads
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
export type RelationOption = { id: string | number; title: string | null }

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
