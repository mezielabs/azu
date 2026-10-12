import string from '@adonisjs/core/helpers/string'
import type { HttpContext } from '@adonisjs/core/http'
import type { LucidModel, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import type { ResourceSchema } from '../schema.ts'
import type { ActionFor } from './actions.ts'
import type { ColumnFor } from './columns.ts'
import type { FieldFor } from './fields.ts'
import type { FilterFor } from './filters.ts'
import type { PolicyClass, Row, StringAttribute, StringColumn } from './model_types.ts'

/**
 * Anything with VineJS's `validate()`: a compiled VineJS validator.
 */
export type ValidatorLike = { validate(data: any, options?: any): Promise<any> }

type Hook<M extends LucidModel> = (record: Row<M>, ctx: HttpContext) => unknown

/**
 * Options for `defineResource`. Every name is checked against `M`, and
 * every ability against `P`.
 */
export type ResourceOptions<M extends LucidModel, P extends PolicyClass> = {
  /** Navigation and page title. Defaults to the plural model name. */
  label?: string
  /** Defaults to the model name, in sentence case. */
  singularLabel?: string
  /** Navigation group. */
  group?: string
  /** Navigation icon name. */
  icon?: string
  /** The attribute that names a record, e.g. in a `belongsTo` select. */
  title?: StringAttribute<M>
  /** Columns the list search looks in. Must be persisted. */
  search?: StringColumn<M>[]
  /** The Bouncer policy. A missing method means denied. */
  policy: P
  validators?: {
    create?: ValidatorLike
    update?: ValidatorLike
    /**
     * VineJS metadata. Defaults to `{ record }`: the record being
     * edited on update, `undefined` on create.
     */
    meta?: (input: { record: Row<M> | undefined; ctx: HttpContext }) => Record<string, unknown>
  }
  /** Scopes every query, e.g. to preload relations shown in columns. */
  query?: (query: ModelQueryBuilderContract<M>) => unknown
  columns?: ColumnFor<M>[]
  fields?: FieldFor<M, P>[]
  filters?: FilterFor<M>[]
  actions?: ActionFor<M, P>[]
  beforeSave?: Hook<M>
  afterSave?: Hook<M>
  beforeDelete?: Hook<M>
}

/**
 * Brands resources across module copies, so discovery can recognise
 * them even if two copies of the package are loaded.
 */
const RESOURCE = Symbol.for('mezielabs.azu.resource')

/**
 * An admin resource: a Lucid model plus how Azu shows and edits it.
 * Create one with `defineResource`.
 */
export class Resource<M extends LucidModel = LucidModel, P extends PolicyClass = PolicyClass> {
  readonly [RESOURCE] = true

  /** URL name: `Product` → `products`, `OrderItem` → `order-items` */
  readonly name: string

  constructor(
    readonly model: M,
    readonly options: ResourceOptions<M, P>
  ) {
    this.name = string.dashCase(string.plural(model.name))
  }

  static isResource(value: unknown): value is Resource {
    return typeof value === 'object' && value !== null && RESOURCE in value
  }

  get label(): string {
    return this.options.label ?? string.sentenceCase(string.plural(this.model.name))
  }

  get singularLabel(): string {
    return this.options.singularLabel ?? string.sentenceCase(this.model.name)
  }

  /**
   * The plain-JSON schema the front end renders from. Handlers, hooks,
   * validators and the policy stay on the server.
   */
  toSchema(): ResourceSchema {
    return {
      name: this.name,
      label: this.label,
      singularLabel: this.singularLabel,
      group: this.options.group ?? null,
      icon: this.options.icon ?? null,
      title: this.options.title ?? null,
      search: [...(this.options.search ?? [])],
      columns: (this.options.columns ?? []).map((column) => column.toJSON()),
      fields: (this.options.fields ?? []).map((item) => item.toJSON()),
      filters: (this.options.filters ?? []).map((item) => item.toJSON()),
      actions: (this.options.actions ?? []).map((item) => item.toJSON()),
    }
  }
}

/**
 * Defines an admin resource for a Lucid model. Names are typed against
 * the model and abilities against the policy, so a typo fails `tsc`.
 * Export it as the default from a file in `app/admin/resources`.
 *
 * @example
 * ```ts
 * export default defineResource(Product, {
 *   policy: ProductPolicy,
 *   title: 'name',
 *   columns: [column.text('name').sortable()],
 * })
 * ```
 */
export function defineResource<Model extends LucidModel, Policy extends PolicyClass>(
  model: Model,
  options: ResourceOptions<NoInfer<Model>, Policy>
): Resource<Model, Policy> {
  return new Resource(model, options as ResourceOptions<Model, Policy>)
}
