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
  /** The policy method each record must pass */
  ability: string | null
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
