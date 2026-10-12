import string from '@adonisjs/core/helpers/string'
import type { LucidModel } from '@adonisjs/lucid/types/model'
import type { ColumnKind, ColumnSchema } from '../schema.ts'
import type {
  AttributeName,
  BooleanAttribute,
  BooleanColumn,
  DateAttribute,
  DateColumn,
  NumberAttribute,
  NumberColumn,
  RelatedModel,
  RelationName,
  StringAttribute,
  StringColumn,
} from './model_types.ts'

type SortableKind = 'text' | 'number' | 'decimal' | 'boolean' | 'badge' | 'date' | 'datetime'

/**
 * A list column. Its name is captured as a literal type, and
 * `defineResource` checks it against the model (see `ColumnFor`).
 * `Sortable` and `Title` are type-level only.
 */
export class Column<
  Kind extends ColumnKind,
  Name extends string,
  Sortable extends boolean = false,
  Title extends string = never,
> {
  declare readonly __sortable: Sortable
  declare readonly __title: Title

  #label: string | null = null
  #sortable = false
  #hiddenByDefault = false
  #component: string | null = null
  #format: ColumnSchema['format'] = null
  #colors: ColumnSchema['colors'] = null

  constructor(
    readonly kind: Kind,
    readonly name: Name,
    readonly relationTitle: Title | null = null
  ) {}

  /**
   * The column heading. Defaults to the name in sentence case.
   */
  label(text: string): this {
    this.#label = text
    return this
  }

  /**
   * Render cells with a component registered from
   * `inertia/admin/components`, by file name.
   */
  component(name: string): this {
    this.#component = name
    return this
  }

  hiddenByDefault(): this {
    this.#hiddenByDefault = true
    return this
  }

  /**
   * Lets users sort by this column, on the server. Only persisted
   * columns can be sorted; `defineResource` rejects getters.
   */
  sortable<K extends Kind & SortableKind, T extends string>(
    this: Column<K, Name, boolean, T>
  ): Column<K, Name, true, T> {
    this.#sortable = true
    return this as unknown as Column<K, Name, true, T>
  }

  /**
   * Formats numbers with `Intl.NumberFormat`. Decimal values are
   * formatted from their exact strings.
   */
  format<C extends Column<'number' | 'decimal', string, boolean, string>>(
    this: C,
    style: 'currency' | 'percent',
    currency?: string
  ): C {
    ;(this as unknown as Column<'number', string>).#format = { style, currency: currency ?? null }
    return this
  }

  /**
   * Badge colours by value, e.g. `{ draft: 'gray', published: 'green' }`.
   */
  colors<C extends Column<'badge', string, boolean, string>>(
    this: C,
    map: Record<string, string>
  ): C {
    ;(this as unknown as Column<'badge', string>).#colors = map
    return this
  }

  toJSON(): ColumnSchema {
    return {
      kind: this.kind,
      name: this.name,
      label: this.#label ?? string.sentenceCase(this.name),
      sortable: this.#sortable,
      hiddenByDefault: this.#hiddenByDefault,
      component: this.#component,
      format: this.#format,
      colors: this.#colors,
      relationTitle: this.relationTitle,
    }
  }
}

/**
 * Column builders. Names are checked against the model by
 * `defineResource`, so a typo fails `tsc`.
 */
export const column = {
  text: <Name extends string>(name: Name) => new Column('text', name),
  number: <Name extends string>(name: Name) => new Column('number', name),
  /** For decimal columns, typed `string`. Formatted exactly. */
  decimal: <Name extends string>(name: Name) => new Column('decimal', name),
  boolean: <Name extends string>(name: Name) => new Column('boolean', name),
  badge: <Name extends string>(name: Name) => new Column('badge', name),
  image: <Name extends string>(name: Name) => new Column('image', name),
  date: <Name extends string>(name: Name) => new Column('date', name),
  datetime: <Name extends string>(name: Name) => new Column('datetime', name),
  /** The related record's `title` attribute, linked. */
  belongsTo: <Relation extends string, Title extends string>(relation: Relation, title: Title) =>
    new Column<'belongsTo', Relation, false, Title>('belongsTo', relation, title),
  /** Any attribute, rendered by a component from `inertia/admin/components`. */
  custom: <Name extends string>(name: Name, component: string) =>
    new Column('custom', name).component(component),
}

/**
 * Every column a resource on `M` accepts. Display columns may use
 * getters; sortable columns must be persisted, because sorting is SQL.
 */
export type ColumnFor<M extends LucidModel> =
  | Column<'text' | 'badge' | 'image', StringAttribute<M>, false>
  | Column<'number', NumberAttribute<M>, false>
  | Column<'decimal', StringAttribute<M>, false>
  | Column<'boolean', BooleanAttribute<M>, false>
  | Column<'date' | 'datetime', DateAttribute<M>, false>
  | Column<'custom', AttributeName<M>, false>
  | Column<'text' | 'badge', StringColumn<M>, true>
  | Column<'number', NumberColumn<M>, true>
  | Column<'decimal', StringColumn<M>, true>
  | Column<'boolean', BooleanColumn<M>, true>
  | Column<'date' | 'datetime', DateColumn<M>, true>
  | {
      [R in RelationName<M, 'belongsTo'>]: Column<
        'belongsTo',
        R,
        false,
        AttributeName<RelatedModel<M, R>>
      >
    }[RelationName<M, 'belongsTo'>]
