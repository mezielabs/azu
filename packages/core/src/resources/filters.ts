import string from '@adonisjs/core/helpers/string'
import { humanize } from './labels.ts'
import type { LucidModel, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import type { FilterKind, FilterSchema } from '../schema.ts'
import type { BooleanColumn, DateColumn, RelationName, StringColumn } from './model_types.ts'

/**
 * A list filter, serialised to a URL query parameter. `Model` is
 * type-level only: it types the query in `filter.custom`.
 */
export class Filter<
  Kind extends FilterKind,
  Name extends string,
  Model extends LucidModel = never,
> {
  declare readonly __model: Model

  #label: string | null = null

  constructor(
    readonly kind: Kind,
    readonly name: Name,
    readonly choices: Record<string, string> | null = null,
    readonly apply: ((query: ModelQueryBuilderContract<Model>) => unknown) | null = null,
    defaultLabel: string | null = null
  ) {
    this.#label = defaultLabel
  }

  label(text: string): this {
    this.#label = text
    return this
  }

  toJSON(): FilterSchema {
    return {
      kind: this.kind,
      name: this.name,
      label: this.#label ?? humanize(this.name),
      options: this.choices,
    }
  }
}

/**
 * Filter builders. Names are checked against the model by
 * `defineResource`.
 */
export const filter = {
  /** Value → label. */
  select: <Name extends string>(name: Name, options: Record<string, string>) =>
    new Filter('select', name, options),
  boolean: <Name extends string>(name: Name) => new Filter('boolean', name),
  dateRange: <Name extends string>(name: Name) => new Filter('dateRange', name),
  belongsTo: <Relation extends string>(relation: Relation) => new Filter('belongsTo', relation),
  /**
   * A named query. The query is typed against the resource's model,
   * with no annotation.
   */
  custom: <Model extends LucidModel>(
    label: string,
    apply: (query: ModelQueryBuilderContract<Model>) => unknown
  ): Filter<'custom', string, Model> =>
    new Filter<'custom', string, Model>('custom', string.dashCase(label), null, apply, label),
}

export type FilterFor<M extends LucidModel> =
  | Filter<'select', StringColumn<M>>
  | Filter<'boolean', BooleanColumn<M>>
  | Filter<'dateRange', DateColumn<M>>
  | Filter<'belongsTo', RelationName<M, 'belongsTo'>>
  | Filter<'custom', string, M>
