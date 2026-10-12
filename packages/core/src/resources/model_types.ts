/**
 * Type-level reading of a Lucid model: which names are attributes,
 * persisted columns, and relations, and of which types. Proven in the
 * Phase 0 spike (docs/spike-findings.md, check 1).
 */
import type { LucidModel, ModelAttributes } from '@adonisjs/lucid/types/model'
import type { DateTime } from 'luxon'

export type Row<Model extends LucidModel> = InstanceType<Model>

/**
 * Data properties: persisted columns plus computed getters. Lucid's
 * `ModelAttributes` drops methods and relations; `$`-prefixed internals
 * such as the generated `$columns` tuple are dropped here.
 */
export type AttributeName<Model extends LucidModel> = Exclude<
  keyof ModelAttributes<Row<Model>>,
  `$${string}`
> &
  string

/**
 * Persisted columns only. AdonisJS 7 schema classes carry a `$columns`
 * tuple, which separates columns from getters. Hand-written models
 * without it fall back to every attribute.
 */
export type ColumnName<Model extends LucidModel> =
  Row<Model> extends { $columns: readonly (infer Name extends string)[] }
    ? Name
    : AttributeName<Model>

type NamesOfType<Model extends LucidModel, Names extends string, Type> = {
  [Name in Names]: NonNullable<Row<Model>[Name & keyof Row<Model>]> extends Type ? Name : never
}[Names]

export type StringAttribute<M extends LucidModel> = NamesOfType<M, AttributeName<M>, string>
export type NumberAttribute<M extends LucidModel> = NamesOfType<M, AttributeName<M>, number>
export type BooleanAttribute<M extends LucidModel> = NamesOfType<M, AttributeName<M>, boolean>
export type DateAttribute<M extends LucidModel> = NamesOfType<M, AttributeName<M>, DateTime>

export type StringColumn<M extends LucidModel> = NamesOfType<M, ColumnName<M>, string>
export type NumberColumn<M extends LucidModel> = NamesOfType<M, ColumnName<M>, number>
export type BooleanColumn<M extends LucidModel> = NamesOfType<M, ColumnName<M>, boolean>
export type DateColumn<M extends LucidModel> = NamesOfType<M, ColumnName<M>, DateTime>

export type RelationKind = 'hasOne' | 'hasMany' | 'belongsTo' | 'manyToMany' | 'hasManyThrough'

/**
 * Relation properties of a kind. Lucid's own `ExtractModelRelations`
 * leaks `string | undefined` (LucidRow has an index signature), so the
 * keys are mapped here and index-signature keys dropped.
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
 * A Bouncer policy class.
 */
export type PolicyClass = abstract new (...args: any[]) => object

/**
 * Policy methods that can gate an action or a field.
 */
export type PolicyAbility<Policy extends PolicyClass> = Exclude<
  {
    [Name in keyof InstanceType<Policy>]: InstanceType<Policy>[Name] extends (...args: any[]) => any
      ? Name
      : never
  }[keyof InstanceType<Policy>],
  'before' | 'after'
> &
  string
