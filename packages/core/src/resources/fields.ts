import string from '@adonisjs/core/helpers/string'
import type { LucidModel } from '@adonisjs/lucid/types/model'
import type { FieldKind, FieldSchema } from '../schema.ts'
import type {
  BooleanColumn,
  DateColumn,
  NumberColumn,
  PolicyAbility,
  PolicyClass,
  RelatedModel,
  RelationName,
  StringColumn,
} from './model_types.ts'

type AnyField<Kind extends FieldKind> = Field<Kind, string, string, string>

type FieldState = Omit<FieldSchema, 'kind' | 'name' | 'label'> & { label: string | null }

/**
 * A form field. Its name is captured as a literal type, and
 * `defineResource` checks it against the model (see `FieldFor`).
 * `Search` and `Ability` are type-level only.
 *
 * There's no `required()`: Azu reads that from the VineJS validator.
 */
export class Field<
  Kind extends FieldKind,
  Name extends string,
  Search extends string = never,
  Ability extends string = never,
> {
  declare readonly __search: Search
  declare readonly __ability: Ability

  #state: FieldState = {
    label: null,
    help: null,
    placeholder: null,
    default: null,
    visibleOn: null,
    readOnly: false,
    ability: null,
    component: null,
    min: null,
    max: null,
    step: null,
    prefix: null,
    suffix: null,
    options: null,
    disk: null,
    maxSize: null,
    searchable: null,
  }

  constructor(
    readonly kind: Kind,
    readonly name: Name
  ) {}

  #set<Key extends keyof FieldState>(key: Key, value: FieldState[Key]): this {
    this.#state[key] = value
    return this
  }

  /** Defaults to the name in sentence case. */
  label(text: string): this {
    return this.#set('label', text)
  }

  help(text: string): this {
    return this.#set('help', text)
  }

  placeholder(text: string): this {
    return this.#set('placeholder', text)
  }

  default(value: string | number | boolean): this {
    return this.#set('default', value)
  }

  /** Show the field only on the create or the edit form. */
  visibleOn(form: 'create' | 'edit'): this {
    return this.#set('visibleOn', form)
  }

  readOnly(): this {
    return this.#set('readOnly', true)
  }

  /** Swap the form control for a component from `inertia/admin/components`. */
  component(name: string): this {
    return this.#set('component', name)
  }

  /**
   * Gate the field behind a policy method. Checked against the
   * resource's policy by `defineResource`.
   */
  ability<A extends string>(name: A): Field<Kind, Name, Search, A> {
    this.#set('ability', name)
    return this as unknown as Field<Kind, Name, Search, A>
  }

  /** UI hint only; validation stays in the VineJS validator. */
  min<F extends AnyField<'number' | 'decimal'>>(this: F, value: number | string): F {
    ;(this as AnyField<'number'>).#set('min', value)
    return this
  }

  max<F extends AnyField<'number' | 'decimal'>>(this: F, value: number | string): F {
    ;(this as AnyField<'number'>).#set('max', value)
    return this
  }

  step<F extends AnyField<'number' | 'decimal'>>(this: F, value: number | string): F {
    ;(this as AnyField<'number'>).#set('step', value)
    return this
  }

  prefix<F extends AnyField<'text'>>(this: F, text: string): F {
    ;(this as AnyField<'text'>).#set('prefix', text)
    return this
  }

  suffix<F extends AnyField<'text'>>(this: F, text: string): F {
    ;(this as AnyField<'text'>).#set('suffix', text)
    return this
  }

  /** Value → label. */
  options<F extends AnyField<'select'>>(this: F, map: Record<string, string>): F {
    ;(this as AnyField<'select'>).#set('options', map)
    return this
  }

  /** The Drive disk uploads are stored on. */
  disk<F extends AnyField<'file' | 'image'>>(this: F, name: string): F {
    ;(this as AnyField<'file'>).#set('disk', name)
    return this
  }

  /** e.g. `'2mb'` */
  maxSize<F extends AnyField<'file' | 'image'>>(this: F, size: string): F {
    ;(this as AnyField<'file'>).#set('maxSize', size)
    return this
  }

  /**
   * The related model's attribute to search and show. Checked against
   * the related model by `defineResource`.
   */
  searchable<K extends Kind & ('belongsTo' | 'manyToMany'), A extends string, S extends string>(
    this: Field<K, Name, string, A>,
    column: S
  ): Field<K, Name, S, A> {
    ;(this as AnyField<'belongsTo'>).#set('searchable', column)
    return this as unknown as Field<K, Name, S, A>
  }

  toJSON(): FieldSchema {
    const { label, ...state } = this.#state
    return {
      kind: this.kind,
      name: this.name,
      label: label ?? string.sentenceCase(this.name),
      ...state,
    }
  }
}

/**
 * Field builders. Names are checked against the model by
 * `defineResource`, so a typo fails `tsc`.
 */
export const field = {
  text: <Name extends string>(name: Name) => new Field('text', name),
  textarea: <Name extends string>(name: Name) => new Field('textarea', name),
  number: <Name extends string>(name: Name) => new Field('number', name),
  /** For decimal columns, typed `string`. The value stays exact. */
  decimal: <Name extends string>(name: Name) => new Field('decimal', name),
  boolean: <Name extends string>(name: Name) => new Field('boolean', name),
  select: <Name extends string>(name: Name) => new Field('select', name),
  date: <Name extends string>(name: Name) => new Field('date', name),
  datetime: <Name extends string>(name: Name) => new Field('datetime', name),
  richText: <Name extends string>(name: Name) => new Field('richText', name),
  file: <Name extends string>(name: Name) => new Field('file', name),
  image: <Name extends string>(name: Name) => new Field('image', name),
  belongsTo: <Relation extends string>(relation: Relation) => new Field('belongsTo', relation),
  hasMany: <Relation extends string>(relation: Relation) => new Field('hasMany', relation),
  manyToMany: <Relation extends string>(relation: Relation) => new Field('manyToMany', relation),
}

/**
 * Every field a resource on `M`, guarded by `P`, accepts. Fields write
 * to the database, so they must be persisted columns or relations.
 */
export type FieldFor<M extends LucidModel, P extends PolicyClass> =
  | Field<
      'text' | 'textarea' | 'richText' | 'file' | 'image' | 'select',
      StringColumn<M>,
      never,
      PolicyAbility<P>
    >
  | Field<'number', NumberColumn<M>, never, PolicyAbility<P>>
  | Field<'decimal', StringColumn<M>, never, PolicyAbility<P>>
  | Field<'boolean', BooleanColumn<M>, never, PolicyAbility<P>>
  | Field<'date' | 'datetime', DateColumn<M>, never, PolicyAbility<P>>
  | {
      [R in RelationName<M, 'belongsTo'>]: Field<
        'belongsTo',
        R,
        StringColumn<RelatedModel<M, R>>,
        PolicyAbility<P>
      >
    }[RelationName<M, 'belongsTo'>]
  | {
      [R in RelationName<M, 'manyToMany'>]: Field<
        'manyToMany',
        R,
        StringColumn<RelatedModel<M, R>>,
        PolicyAbility<P>
      >
    }[RelationName<M, 'manyToMany'>]
  | Field<'hasMany', RelationName<M, 'hasMany'>, never, PolicyAbility<P>>
