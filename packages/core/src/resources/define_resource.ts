import string from '@adonisjs/core/helpers/string'
import { humanize } from './labels.ts'
import type { HttpContext } from '@adonisjs/core/http'
import type { LucidModel, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import type { ResourceSchema } from '../schema.ts'
import { RuntimeException } from '@adonisjs/core/exceptions'
import { Action, type ActionFor } from './actions.ts'
import type { ColumnFor } from './columns.ts'
import type { FieldFor } from './fields.ts'
import type { Filter, FilterFor } from './filters.ts'
import { LIST_PARAMS } from '../shared/list_filters.ts'
import { PAGE_SLOTS, SLOT_NAMES, type SlotName, type SlotPage } from '../shared/slots.ts'
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
  /**
   * Navigation icon: a Lucide icon name in kebab case, `'package'` or
   * `'shopping-cart'` (lucide.dev/icons). Shown when the app has
   * `lucide-react` installed; the `azu()` Vite plugin bundles only the
   * icons resources name.
   */
  icon?: string
  /**
   * Position in its navigation group: lower comes first. Resources
   * without one follow, in label order.
   */
  order?: number
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
  /**
   * Components from `inertia/admin/components`, by registered name,
   * rendered at named places on this resource's pages (FR-15):
   *
   * - `header`: under the page title, on every page
   * - `toolbar`: beside the page's own buttons (New, Edit), on every page
   * - `beforeTable`: above the list's table
   * - `afterForm`: under the create and edit forms
   *
   * Each gets `SlotProps`. Name the component, or give it data from
   * the server too: `{ component: 'LowStockNotice', data: async () =>
   * ({ count }) }`.
   */
  slots?: Partial<Record<SlotName, string | SlotDefinition<M>>>
}

/**
 * A slot's component, with data for it from the server (FR-15).
 */
export type SlotDefinition<M extends LucidModel> = {
  /** A component from `inertia/admin/components`, by registered name */
  component: string
  /**
   * Runs on the server for each page the slot renders on, after the
   * page's own policy check; its result reaches the component as
   * `SlotProps.data`. Return JSON-serialisable data. `record` is the
   * record on the edit and detail pages, else `null`.
   */
  data?: (input: { ctx: HttpContext; page: SlotPage; record: InstanceType<M> | null }) => unknown
}

/**
 * The built-in Delete actions, which the action endpoint runs itself.
 */
const BUILT_IN_DELETE = new WeakSet<object>()

function builtInDelete(kind: 'row' | 'bulk', confirm: string) {
  const deleteAction = new Action(kind, 'delete')
    .label('Delete')
    .confirm(confirm)
    .ability('delete')
    .destructive()
  BUILT_IN_DELETE.add(deleteAction)
  return deleteAction
}

/**
 * Whether an action is the built-in Delete.
 */
export function isBuiltInDelete(candidate: object): boolean {
  return BUILT_IN_DELETE.has(candidate)
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

  #actions: Action<'row' | 'bulk', any, any, any>[] | null = null
  #filters: Filter<any, string, any>[] | null = null

  /**
   * The resource's filters (FR-13). Each is a URL query parameter named
   * after it, so two filters can't share a name, and none may take one
   * of the list's own parameters (`page`, `sort`, `search`…).
   */
  filters(): Filter<any, string, any>[] {
    if (this.#filters) return this.#filters
    const filters = (this.options.filters ?? []) as Filter<any, string, any>[]
    const seen = new Set<string>()
    for (const item of filters) {
      if ((LIST_PARAMS as readonly string[]).includes(item.name)) {
        throw new RuntimeException(
          `Resource "${this.name}" has a filter named "${item.name}", which the list uses for its own URL parameter. Give it a label that names it differently.`
        )
      }
      if (seen.has(item.name)) {
        throw new RuntimeException(
          `Resource "${this.name}" has two filters named "${item.name}"; each needs its own URL parameter.`
        )
      }
      seen.add(item.name)
    }
    this.#filters = filters
    return filters
  }

  /**
   * The resource's actions, then the built-in Delete (row and bulk) when
   * the policy has a `delete` method. A missing method means no Delete.
   */
  actions(): Action<'row' | 'bulk', any, any, any>[] {
    if (this.#actions) return this.#actions
    const declared = (this.options.actions ?? []) as Action<'row' | 'bulk', any, any, any>[]
    if (declared.some((item) => item.name === 'delete')) {
      throw new RuntimeException(
        `Resource "${this.name}" declares an action named "delete", which is Azu's built-in Delete. Name it differently.`
      )
    }
    const policy = this.options.policy as { prototype?: Record<string, unknown> }
    const deletes =
      typeof policy?.prototype?.delete === 'function'
        ? [
            builtInDelete('row', `Delete this ${this.singularLabel.toLowerCase()}?`),
            builtInDelete('bulk', `Delete the selected ${this.label.toLowerCase()}?`),
          ]
        : []
    this.#actions = [...declared, ...deletes]
    return this.#actions
  }

  get label(): string {
    return this.options.label ?? humanize(string.plural(this.model.name))
  }

  get singularLabel(): string {
    return this.options.singularLabel ?? humanize(this.model.name)
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
      columns: (this.options.columns ?? []).map((column) => {
        const schema = column.toJSON()
        // A select field's labels name the column's values too, else a
        // select filter's of the same name
        const options =
          (this.options.fields ?? [])
            .map((item) => item.toJSON())
            .find((item) => item.name === schema.name && item.kind === 'select')?.options ??
          this.filters()
            .map((item) => item.toJSON())
            .find((item) => item.name === schema.name && item.kind === 'select')?.options
        return options ? { ...schema, labels: options } : schema
      }),
      fields: (this.options.fields ?? []).map((item) => item.toJSON()),
      filters: this.filters().map((item) => item.toJSON()),
      actions: this.actions().map((item) => item.toJSON()),
      slots: Object.fromEntries(
        SLOT_NAMES.map((slot) => {
          const definition = this.options.slots?.[slot]
          return [
            slot,
            typeof definition === 'string' ? definition : (definition?.component ?? null),
          ]
        })
      ) as Record<SlotName, string | null>,
    }
  }

  /**
   * The data a page's slots asked for (`slots: { name: { data } }`), by
   * slot name, for the slots that render on that page.
   */
  async slotData(
    ctx: HttpContext,
    page: SlotPage,
    record: InstanceType<M> | null = null
  ): Promise<Partial<Record<SlotName, unknown>>> {
    const data: Partial<Record<SlotName, unknown>> = {}
    for (const slot of PAGE_SLOTS[page]) {
      const definition = this.options.slots?.[slot]
      if (typeof definition === 'object' && definition.data) {
        data[slot] = (await definition.data({ ctx, page, record })) ?? null
      }
    }
    return data
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
