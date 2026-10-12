/**
 * SPIKE (Phase 0, risk check 1). Throwaway. Do not build on this file.
 *
 * Proves that `defineResource(Model, { ... })` can type column, field,
 * filter, and action names against a Lucid model without the user writing
 * generics, while keeping the README's imported-builder API
 * (`column.text('name')`, not `(c) => c.text('name')`).
 *
 * The trick: each builder captures its name as a string literal type
 * (`Column<'text', 'name'>`), and `defineResource` checks the finished
 * array against a union computed from the model (`ColumnFor<Model>`).
 */
import type {
  LucidModel,
  LucidRow,
  ModelAttributes,
  ModelQueryBuilderContract,
} from '@adonisjs/lucid/types/model'
import type { DateTime } from 'luxon'

/*
|--------------------------------------------------------------------------
| Model introspection types
|--------------------------------------------------------------------------
*/

type Row<Model extends LucidModel> = InstanceType<Model>

/**
 * Data properties on the model: persisted columns plus computed getters.
 * Lucid's `ModelAttributes` already drops methods and relations; we also
 * drop `$`-prefixed internals such as the generated `$columns` tuple.
 */
export type AttributeName<Model extends LucidModel> = Exclude<
  keyof ModelAttributes<Row<Model>>,
  `$${string}`
> &
  string

/**
 * Persisted columns only. AdonisJS 7 schema classes carry a `$columns`
 * tuple, which separates real columns from getters. Hand-written models
 * without it fall back to every attribute.
 */
export type ColumnName<Model extends LucidModel> =
  Row<Model> extends { $columns: readonly (infer Name extends string)[] }
    ? Name
    : AttributeName<Model>

type NamesOfType<Model extends LucidModel, Names extends string, Type> = {
  [Name in Names]: NonNullable<Row<Model>[Name & keyof Row<Model>]> extends Type ? Name : never
}[Names]

type StringAttribute<M extends LucidModel> = NamesOfType<M, AttributeName<M>, string>
type NumberAttribute<M extends LucidModel> = NamesOfType<M, AttributeName<M>, number>
type BooleanAttribute<M extends LucidModel> = NamesOfType<M, AttributeName<M>, boolean>
type DateAttribute<M extends LucidModel> = NamesOfType<M, AttributeName<M>, DateTime>

type StringColumn<M extends LucidModel> = NamesOfType<M, ColumnName<M>, string>
type NumberColumn<M extends LucidModel> = NamesOfType<M, ColumnName<M>, number>
type BooleanColumn<M extends LucidModel> = NamesOfType<M, ColumnName<M>, boolean>
type DateColumn<M extends LucidModel> = NamesOfType<M, ColumnName<M>, DateTime>

type RelationKind = 'hasOne' | 'hasMany' | 'belongsTo' | 'manyToMany' | 'hasManyThrough'

/**
 * Relation properties of a given kind. Lucid's own `ExtractModelRelations`
 * leaks `string | undefined` here (LucidRow has an index signature), so we
 * map over the keys ourselves and drop index-signature keys.
 */
export type RelationName<Model extends LucidModel, Kind extends RelationKind = RelationKind> = {
  [Name in keyof Row<Model>]-?: Name extends string
    ? string extends Name
      ? never
      : NonNullable<Row<Model>[Name]> extends { __opaque_type: Kind }
        ? Name
        : never
    : never
}[keyof Row<Model>]

export type RelatedModel<Model extends LucidModel, Name extends string> =
  NonNullable<Row<Model>[Name & keyof Row<Model>]> extends {
    model: infer Related extends LucidModel
  }
    ? Related
    : never

/**
 * Methods on a Bouncer policy class that can gate an action.
 */
type PolicyClass = abstract new (...args: any[]) => object
export type PolicyAbility<Policy extends PolicyClass> = Exclude<
  {
    [Name in keyof InstanceType<Policy>]: InstanceType<Policy>[Name] extends (...args: any[]) => any
      ? Name
      : never
  }[keyof InstanceType<Policy>],
  'before' | 'after'
> &
  string

/*
|--------------------------------------------------------------------------
| Builders
|--------------------------------------------------------------------------
*/

class Column<Kind extends string, Name extends string, Sortable extends boolean = false> {
  declare readonly sortableFlag: Sortable
  readonly meta: Record<string, unknown> = {}

  constructor(
    readonly kind: Kind,
    readonly name: Name
  ) {}

  sortable(): Column<Kind, Name, true> {
    this.meta.sortable = true
    return this as unknown as Column<Kind, Name, true>
  }

  component(name: string): this {
    this.meta.component = name
    return this
  }

  hiddenByDefault(): this {
    this.meta.hiddenByDefault = true
    return this
  }

  format(style: 'currency' | 'percent', currency?: string): this {
    this.meta.format = { style, currency }
    return this
  }

  colors(map: Record<string, string>): this {
    this.meta.colors = map
    return this
  }
}

class BelongsToColumn<Relation extends string, Title extends string> extends Column<
  'belongsTo',
  Relation
> {
  constructor(
    relation: Relation,
    readonly title: Title
  ) {
    super('belongsTo', relation)
  }
}

class Field<Kind extends string, Name extends string> {
  readonly meta: Record<string, unknown> = {}

  constructor(
    readonly kind: Kind,
    readonly name: Name
  ) {}

  min(value: number): this {
    this.meta.min = value
    return this
  }

  disk(name: string): this {
    this.meta.disk = name
    return this
  }

  maxSize(size: string): this {
    this.meta.maxSize = size
    return this
  }
}

class SelectField<Name extends string> extends Field<'select', Name> {
  constructor(name: Name) {
    super('select', name)
  }

  options(map: Record<string, string>): this {
    this.meta.options = map
    return this
  }
}

class RelationField<
  Kind extends string,
  Relation extends string,
  Search extends string = never,
> extends Field<Kind, Relation> {
  declare readonly searchColumn: Search

  searchable<Column extends string>(column: Column): RelationField<Kind, Relation, Column> {
    this.meta.searchable = column
    return this as unknown as RelationField<Kind, Relation, Column>
  }
}

class Filter<Kind extends string, Name extends string> {
  constructor(
    readonly kind: Kind,
    readonly name: Name,
    readonly options?: unknown
  ) {}
}

type ActionResult = { message: string } | { redirect: string } | void

class BulkAction<Record extends LucidRow = LucidRow, Ability extends string = never> {
  declare readonly ability_: Ability
  #handler?: (records: Record[]) => Promise<ActionResult>
  readonly meta: { confirm?: string; ability?: string } = {}

  constructor(readonly name: string) {}

  confirm(message: string): this {
    this.meta.confirm = message
    return this
  }

  ability<Name extends string>(name: Name): BulkAction<Record, Name> {
    this.meta.ability = name
    return this as unknown as BulkAction<Record, Name>
  }

  /**
   * Generic over the record type so TypeScript can infer it from the
   * contextual type `defineResource` expects. That's what types the
   * `products` parameter without the user annotating it.
   */
  handle<Records extends LucidRow>(
    handler: (records: Records[]) => Promise<ActionResult>
  ): BulkAction<Records, Ability> {
    const self = this as unknown as BulkAction<Records, Ability>
    self.#handler = handler
    return self
  }

  run(records: Record[]) {
    return this.#handler!(records)
  }
}

export const column = {
  text: <Name extends string>(name: Name) => new Column('text', name),
  number: <Name extends string>(name: Name) => new Column('number', name),
  boolean: <Name extends string>(name: Name) => new Column('boolean', name),
  badge: <Name extends string>(name: Name) => new Column('badge', name),
  image: <Name extends string>(name: Name) => new Column('image', name),
  datetime: <Name extends string>(name: Name) => new Column('datetime', name),
  belongsTo: <Relation extends string, Title extends string>(relation: Relation, title: Title) =>
    new BelongsToColumn(relation, title),
}

export const field = {
  text: <Name extends string>(name: Name) => new Field('text', name),
  textarea: <Name extends string>(name: Name) => new Field('textarea', name),
  number: <Name extends string>(name: Name) => new Field('number', name),
  boolean: <Name extends string>(name: Name) => new Field('boolean', name),
  select: <Name extends string>(name: Name) => new SelectField(name),
  richText: <Name extends string>(name: Name) => new Field('richText', name),
  image: <Name extends string>(name: Name) => new Field('image', name),
  datetime: <Name extends string>(name: Name) => new Field('datetime', name),
  belongsTo: <Relation extends string>(relation: Relation) =>
    new RelationField('belongsTo', relation),
  manyToMany: <Relation extends string>(relation: Relation) =>
    new RelationField('manyToMany', relation),
}

export const filter = {
  select: <Name extends string>(name: Name, options: Record<string, string>) =>
    new Filter('select', name, options),
  boolean: <Name extends string>(name: Name) => new Filter('boolean', name),
  dateRange: <Name extends string>(name: Name) => new Filter('dateRange', name),
  belongsTo: <Relation extends string>(relation: Relation) => new Filter('belongsTo', relation),
  custom: (label: string, apply: (query: ModelQueryBuilderContract<LucidModel>) => void) =>
    new Filter('custom', label, apply),
}

export const action = {
  bulk: (name: string) => new BulkAction(name),
}

/*
|--------------------------------------------------------------------------
| What a resource accepts, computed from the model
|--------------------------------------------------------------------------
*/

export type ColumnFor<M extends LucidModel> =
  // Display-only columns can use getters too
  | Column<'text' | 'badge' | 'image', StringAttribute<M>, false>
  | Column<'number', NumberAttribute<M>, false>
  | Column<'boolean', BooleanAttribute<M>, false>
  | Column<'datetime', DateAttribute<M>, false>
  // Sortable columns must be real columns, because sorting is SQL
  | Column<'text' | 'badge', StringColumn<M>, true>
  | Column<'number', NumberColumn<M>, true>
  | Column<'boolean', BooleanColumn<M>, true>
  | Column<'datetime', DateColumn<M>, true>
  | {
      [R in RelationName<M, 'belongsTo'>]: BelongsToColumn<R, AttributeName<RelatedModel<M, R>>>
    }[RelationName<M, 'belongsTo'>]

export type FieldFor<M extends LucidModel> =
  | Field<'text' | 'textarea' | 'richText' | 'image', StringColumn<M>>
  | SelectField<StringColumn<M>>
  | Field<'number', NumberColumn<M>>
  | Field<'boolean', BooleanColumn<M>>
  | Field<'datetime', DateColumn<M>>
  | {
      [R in RelationName<M, 'belongsTo' | 'manyToMany'>]: RelationField<
        'belongsTo' | 'manyToMany',
        R,
        StringColumn<RelatedModel<M, R>>
      >
    }[RelationName<M, 'belongsTo' | 'manyToMany'>]

export type FilterFor<M extends LucidModel> =
  | Filter<'select', StringColumn<M>>
  | Filter<'boolean', BooleanColumn<M>>
  | Filter<'dateRange', DateColumn<M>>
  | Filter<'belongsTo', RelationName<M, 'belongsTo'>>
  | Filter<'custom', string>

export type ActionFor<M extends LucidModel, Policy extends PolicyClass> = BulkAction<
  Row<M>,
  PolicyAbility<Policy>
>

type VineValidatorLike = { validate: (data: any, options?: any) => Promise<any> }

export type ResourceOptions<M extends LucidModel, Policy extends PolicyClass> = {
  label?: string
  group?: string
  icon?: string
  title?: StringAttribute<M>
  search?: StringColumn<M>[]
  policy: Policy
  validators?: { create?: VineValidatorLike; update?: VineValidatorLike }
  query?: (query: ModelQueryBuilderContract<M>) => unknown
  columns?: ColumnFor<M>[]
  fields?: FieldFor<M>[]
  filters?: FilterFor<M>[]
  actions?: ActionFor<M, Policy>[]
}

/**
 * `NoInfer` keeps TypeScript from inferring `Model` from the columns or
 * fields. It must come from the first argument only.
 */
export function defineResource<Model extends LucidModel, Policy extends PolicyClass>(
  model: Model,
  options: ResourceOptions<NoInfer<Model>, Policy>
) {
  return { model, options }
}
