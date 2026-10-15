import string from '@adonisjs/core/helpers/string'
import type { HttpContext } from '@adonisjs/core/http'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { LucidModel, LucidRow } from '@adonisjs/lucid/types/model'
import { withHints } from '../forms/form_fields.ts'
import { introspectValidator, isIntrospectable } from '../forms/introspect.ts'
import type { ActionSchema, FieldKind } from '../schema.ts'
import type { ValidatorLike } from './define_resource.ts'
import type { Field } from './fields.ts'
import type { PolicyAbility, PolicyClass, Row } from './model_types.ts'

/**
 * What an action handler returns: a toast message or a redirect.
 */
export type ActionResult = { message: string } | { redirect: string } | void

/**
 * What a handler gets besides its records.
 */
export type ActionContext<Input> = {
  ctx: HttpContext
  /** The dialog's input, as the action's validator output it */
  input: Input
  /**
   * The action's transaction. The records are bound to it; run other
   * queries through it too (`Product.query({ client: trx })`), so a
   * thrown error rolls everything back.
   */
  trx: TransactionClientContract
}

type Handler<Kind extends 'row' | 'bulk', Record extends LucidRow, Input> = (
  records: Kind extends 'bulk' ? Record[] : Record,
  context: ActionContext<Input>
) => Promise<ActionResult> | ActionResult

/**
 * The field kinds an action dialog can show.
 */
export type DialogFieldKind = Exclude<
  FieldKind,
  'richText' | 'file' | 'image' | 'belongsTo' | 'hasMany' | 'manyToMany'
>

type DialogField = Field<DialogFieldKind, string, string, string>

/**
 * The ability an action checks when it doesn't name one: actions change
 * records, so by default they need `update`.
 */
export const DEFAULT_ACTION_ABILITY = 'update'

/**
 * A row or bulk action. `Ability` is checked against the resource's
 * policy by `defineResource`.
 */
export class Action<
  Kind extends 'row' | 'bulk',
  Record extends LucidRow = LucidRow,
  Ability extends string = never,
  Input = undefined,
> {
  declare readonly __ability: Ability

  #label: string | null = null
  #confirm: string | null = null
  #ability: string | null = null
  #destructive = false
  #fields: DialogField[] = []
  #validator: ValidatorLike | null = null
  #handler: Handler<Kind, Record, Input> | null = null

  constructor(
    readonly kind: Kind,
    readonly name: string
  ) {}

  label(text: string): this {
    this.#label = text
    return this
  }

  /** Ask for confirmation first. */
  confirm(message: string): this {
    this.#confirm = message
    return this
  }

  /** Style it as destructive, like Delete. */
  destructive(): this {
    this.#destructive = true
    return this
  }

  /**
   * The policy method each record must pass, called with the user and
   * the record. In a bulk action, records that fail are skipped and
   * reported. Without one, the action checks `update`.
   */
  ability<A extends string>(name: A): Action<Kind, Record, A, Input> {
    this.#ability = name
    return this as unknown as Action<Kind, Record, A, Input>
  }

  /**
   * Fields to fill in before the action runs, shown in its dialog. The
   * input goes through `validator` (a VineJS validator, like the
   * resource's), and the handler gets its output as `input`.
   *
   * @example
   * ```ts
   * action.row('restock')
   *   .fields([field.number('quantity')], restockValidator)
   *   .handle(async (product, { input }) => {
   *     product.stock += input.quantity
   *     await product.save()
   *   })
   * ```
   */
  fields<V extends ValidatorLike>(
    fields: DialogField[],
    validator: V
  ): Action<Kind, Record, Ability, Awaited<ReturnType<V['validate']>>> {
    this.#fields = fields
    this.#validator = validator
    return this as unknown as Action<Kind, Record, Ability, Awaited<ReturnType<V['validate']>>>
  }

  /**
   * Generic over the record type so TypeScript infers it from the
   * resource: the handler's records are typed with no annotation.
   */
  handle<R extends LucidRow>(handler: Handler<Kind, R, Input>): Action<Kind, R, Ability, Input> {
    const self = this as unknown as Action<Kind, R, Ability, Input>
    self.#handler = handler
    return self
  }

  /** @internal Run by the action endpoint */
  get handler(): Handler<Kind, Record, Input> | null {
    return this.#handler
  }

  /** @internal The dialog's validator */
  get validator(): ValidatorLike | null {
    return this.#validator
  }

  /** The policy method this action checks for each record */
  get effectiveAbility(): string {
    return this.#ability ?? DEFAULT_ACTION_ABILITY
  }

  toJSON(): ActionSchema {
    const hints =
      this.#validator && isIntrospectable(this.#validator)
        ? introspectValidator(this.#validator)
        : new Map()
    return {
      kind: this.kind,
      name: this.name,
      label: this.#label ?? string.sentenceCase(this.name),
      confirm: this.#confirm,
      ability: this.effectiveAbility,
      destructive: this.#destructive,
      fields: this.#fields.map((item) => {
        const schema = item.toJSON()
        return withHints(schema, hints.get(schema.name))
      }),
    }
  }
}

export const action = {
  /** Runs on one record, from its row or its detail page. */
  row: (name: string) => new Action('row', name),
  /** Runs on the selected records. */
  bulk: (name: string) => new Action('bulk', name),
}

export type ActionFor<M extends LucidModel, P extends PolicyClass> =
  Action<'row', Row<M>, PolicyAbility<P>, any> | Action<'bulk', Row<M>, PolicyAbility<P>, any>
