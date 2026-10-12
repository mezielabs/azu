import string from '@adonisjs/core/helpers/string'
import type { HttpContext } from '@adonisjs/core/http'
import type { LucidModel, LucidRow } from '@adonisjs/lucid/types/model'
import type { ActionSchema } from '../schema.ts'
import type { PolicyAbility, PolicyClass, Row } from './model_types.ts'

/**
 * What an action handler returns: a toast message or a redirect.
 */
export type ActionResult = { message: string } | { redirect: string } | void

type Handler<Kind extends 'row' | 'bulk', Record extends LucidRow> = Kind extends 'bulk'
  ? (records: Record[], ctx: HttpContext) => Promise<ActionResult> | ActionResult
  : (record: Record, ctx: HttpContext) => Promise<ActionResult> | ActionResult

/**
 * A row or bulk action. `Ability` is checked against the resource's
 * policy by `defineResource`.
 */
export class Action<
  Kind extends 'row' | 'bulk',
  Record extends LucidRow = LucidRow,
  Ability extends string = never,
> {
  declare readonly __ability: Ability

  #label: string | null = null
  #confirm: string | null = null
  #ability: string | null = null
  #handler: Handler<Kind, Record> | null = null

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

  /**
   * The policy method each record must pass. In a bulk action, records
   * that fail are skipped and reported.
   */
  ability<A extends string>(name: A): Action<Kind, Record, A> {
    this.#ability = name
    return this as unknown as Action<Kind, Record, A>
  }

  /**
   * Generic over the record type so TypeScript infers it from the
   * resource: the handler's records are typed with no annotation.
   */
  handle<R extends LucidRow>(handler: Handler<Kind, R>): Action<Kind, R, Ability> {
    const self = this as unknown as Action<Kind, R, Ability>
    self.#handler = handler
    return self
  }

  /** @internal Run by the action endpoint (FR-12) */
  get handler(): Handler<Kind, Record> | null {
    return this.#handler
  }

  toJSON(): ActionSchema {
    return {
      kind: this.kind,
      name: this.name,
      label: this.#label ?? string.sentenceCase(this.name),
      confirm: this.#confirm,
      ability: this.#ability,
    }
  }
}

export const action = {
  /** Runs on one record, from its row. */
  row: (name: string) => new Action('row', name),
  /** Runs on the selected records. */
  bulk: (name: string) => new Action('bulk', name),
}

export type ActionFor<M extends LucidModel, P extends PolicyClass> =
  Action<'row', Row<M>, PolicyAbility<P>> | Action<'bulk', Row<M>, PolicyAbility<P>>
