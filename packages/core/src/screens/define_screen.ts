import type { HttpContext } from '@adonisjs/core/http'
import type { BouncerAbility } from '@adonisjs/bouncer/types'
import type { DateTime } from 'luxon'
import type { FieldKind, FieldSchema, ScreenSchema } from '../schema.ts'
import type { ValidatorLike } from '../resources/define_resource.ts'
import { Field } from '../resources/fields.ts'
import { DEFAULT_RANGES, type RangeName } from '../shared/metrics.ts'
import type { ScreenWidget } from '../widgets/metrics.ts'
import { assertWidgets } from '../widgets/validate.ts'

/**
 * A Bouncer ability, as `Bouncer.ability()` returns it. A screen needs
 * one: there's no default, so a screen never opens by accident.
 */
export type ScreenAbility = BouncerAbility<any>

/** What every screen takes */
type ScreenBase = {
  /** The screen's title, in the navigation and its page header */
  label: string
  /** Navigation group, like a resource's */
  group?: string
  /** Lucide icon name for the navigation */
  icon?: string
  /** Position within its group: lower first, then by label */
  order?: number
  /**
   * Who may open it: a Bouncer ability object from
   * `app/abilities/main.ts`, checked on every request. False, or an
   * ability that throws, is denied. For a form, it covers saving too.
   */
  ability: ScreenAbility
}

/**
 * A screen with your component (FR-20).
 */
export type ComponentScreenOptions<Data> = ScreenBase & {
  /** The component from `inertia/admin/components` that renders it, by registered name */
  component: string
  /**
   * The screen's data, computed on the server for each request, after
   * the ability check. The component gets it as `data`. Return plain,
   * JSON-serialisable values. Lazy, so a partial reload of `data`
   * computes only this.
   */
  data?: (ctx: HttpContext) => Data | Promise<Data>
  form?: never
  widgets?: never
  ranges?: never
}

/** The field kinds a screen form takes (FR-23); files and relations wait */
export const SCREEN_FIELD_KINDS: ReadonlySet<FieldKind> = new Set([
  'text',
  'textarea',
  'number',
  'decimal',
  'boolean',
  'select',
  'date',
  'datetime',
  'richText',
])

/** The keys of `V` whose values are `T` (or empty) */
type KeysOfType<V, T> = {
  [K in keyof V & string]: NonNullable<V[K]> extends T ? K : never
}[keyof V & string]

/**
 * A field a screen form over values `V` accepts: its name is a key of
 * what `load` returns, of a type that fits the field's kind. No
 * `.ability()`: the screen's ability covers the whole form.
 */
export type ScreenFieldFor<V> =
  | Field<'text' | 'textarea' | 'richText' | 'select', KeysOfType<V, string>, never, never>
  | Field<'decimal', KeysOfType<V, string>, never, never>
  | Field<'number', KeysOfType<V, number>, never, never>
  | Field<'boolean', KeysOfType<V, boolean>, never, never>
  | Field<'date' | 'datetime', KeysOfType<V, DateTime>, never, never>

/** What a validator outputs */
type ValidatorOutput<Validator extends ValidatorLike> = Awaited<ReturnType<Validator['validate']>>

/**
 * A screen form (FR-23): Azu renders the form, `load` gives its values,
 * the validator checks a save, and `save` stores the validator's output.
 * Where the values live is the app's: a settings table, a file, an API.
 */
export type ScreenForm<Values, Validator extends ValidatorLike = ValidatorLike> = {
  /** The form's fields, named after the keys `load` returns */
  fields: ScreenFieldFor<Values>[]
  /** A VineJS validator for the writable fields; read-only ones reach it with load's values */
  validator: Validator
  /** The values to show, as stored, read on every request */
  load: (ctx: HttpContext) => Values | Promise<Values>
  /**
   * Stores a valid save: the validator's output for the writable fields,
   * nothing from the request directly. A throw is a 500.
   */
  save: (input: ValidatorOutput<Validator>, ctx: HttpContext) => void | Promise<void>
  /** The toast after a save. Default: "<label> saved" */
  successMessage?: string
}

/**
 * A screen with a form Azu renders (FR-23), instead of a component.
 */
export type FormScreenOptions<Values, Validator extends ValidatorLike> = ScreenBase & {
  form: ScreenForm<Values, Validator>
  component?: never
  data?: never
  widgets?: never
  ranges?: never
}

/**
 * A screen of widgets Azu renders (FR-24): figures, goals, breakdowns
 * and short tables, from `metric` builders.
 */
export type WidgetsScreenOptions = ScreenBase & {
  /** The widgets, in grid order */
  widgets: ScreenWidget[]
  /**
   * The ranges the range switch offers; the first is the default.
   * Default: `['30d']`, with no switch.
   */
  ranges?: RangeName[]
  component?: never
  data?: never
  form?: never
}

/**
 * Options for `defineScreen`: `component` (your component, with
 * optional `data`), `form` (a form Azu renders) or `widgets` (widgets
 * Azu renders). Exactly one.
 */
export type ScreenOptions<Data> =
  ComponentScreenOptions<Data> | FormScreenOptions<any, ValidatorLike> | WidgetsScreenOptions

const SCREEN = Symbol.for('azu.screen')

/**
 * A custom screen in the admin panel (FR-20): a page of its own with
 * your component, behind its own ability. Make one with `defineScreen`.
 */
export class Screen<Data = null> {
  readonly [SCREEN] = true
  /** Type-only: what `data` resolves to, for `ScreenProps` */
  declare readonly __data: Data

  constructor(readonly options: ScreenOptions<Data>) {}

  /** The screen's form (FR-23); `undefined` for a component screen */
  get form(): ScreenForm<any> | undefined {
    return this.options.form
  }

  /** The screen's widgets (FR-24); `undefined` for other screens */
  get widgets(): readonly ScreenWidget[] | undefined {
    return this.options.widgets
  }

  /** The ranges a widgets screen offers, the default first */
  get ranges(): readonly RangeName[] {
    return this.options.ranges?.length ? this.options.ranges : DEFAULT_RANGES
  }

  static isScreen(value: unknown): value is Screen<unknown> {
    return typeof value === 'object' && value !== null && SCREEN in value
  }

  /** What the page and the navigation get, under its registered name */
  toSchema(name: string): ScreenSchema {
    return {
      name,
      label: this.options.label,
      group: this.options.group ?? null,
      icon: this.options.icon ?? null,
      component: this.options.component ?? null,
      form: this.options.form !== undefined,
      widgets: this.options.widgets !== undefined,
    }
  }
}

/**
 * Defines a custom screen (FR-20). Put it in `app/admin/screens` as the
 * file's default export; its name comes from the file
 * (`sales_report.ts` → `sales-report`, at `/admin/screens/sales-report`).
 *
 * @example
 * ```ts
 * import { defineScreen } from '@mezielabs/azu'
 * import { viewReports } from '#abilities/main'
 *
 * export default defineScreen({
 *   label: 'Sales report',
 *   group: 'Reports',
 *   ability: viewReports,
 *   component: 'SalesReport',
 *   data: async (ctx) => ({ days: await totalsByDay(ctx) }),
 * })
 * ```
 */
export function defineScreen<
  Data = null,
  Values = never,
  Validator extends ValidatorLike = ValidatorLike,
>(
  options:
    ComponentScreenOptions<Data> | FormScreenOptions<Values, Validator> | WidgetsScreenOptions
): Screen<Data>
export function defineScreen(options: ScreenOptions<unknown>): Screen<unknown> {
  if (!options || typeof options.label !== 'string' || options.label.trim() === '') {
    throw new Error('defineScreen() needs a label')
  }
  const { label } = options
  if (
    !options.ability ||
    typeof (options.ability as { execute?: unknown }).execute !== 'function'
  ) {
    throw new Error(
      `The "${label}" screen needs an ability: a Bouncer ability object, such as accessAdmin from #abilities/main`
    )
  }
  const hasComponent = options.component !== undefined
  const hasForm = options.form !== undefined
  const hasWidgets = options.widgets !== undefined
  const bodies = [hasComponent, hasForm, hasWidgets].filter(Boolean).length
  if (bodies !== 1) {
    throw new Error(
      `The "${label}" screen needs exactly one of "component" (your component), "form" (a form Azu renders) or "widgets" (widgets Azu renders)` +
        (bodies > 1 ? ', not more than one' : '')
    )
  }
  if (options.ranges !== undefined && !hasWidgets) {
    throw new Error(`The "${label}" screen has "ranges", which only a widgets screen uses`)
  }
  if (hasComponent && (typeof options.component !== 'string' || options.component === '')) {
    throw new Error(`The "${label}" screen needs a component name`)
  }
  if (hasForm) assertForm(label, options as FormScreenOptions<unknown, ValidatorLike>)
  if (hasWidgets) assertWidgets(label, options as WidgetsScreenOptions)
  return new Screen(options)
}

/**
 * A screen form's shape (FR-23), checked at boot: no `data` beside it,
 * the functions it needs, and fields of the kinds a screen supports,
 * without `.ability()`.
 */
function assertForm(label: string, options: FormScreenOptions<unknown, ValidatorLike>) {
  const { form } = options
  if ((options as { data?: unknown }).data !== undefined) {
    throw new Error(
      `The "${label}" screen has a form and "data": a form's values come from its "load"`
    )
  }
  for (const key of ['load', 'save'] as const) {
    if (typeof form[key] !== 'function') {
      throw new Error(`The "${label}" screen's form needs a "${key}" function`)
    }
  }
  if (typeof form.validator?.validate !== 'function') {
    throw new Error(`The "${label}" screen's form needs a VineJS validator`)
  }
  if (!Array.isArray(form.fields) || form.fields.length === 0) {
    throw new Error(`The "${label}" screen's form needs fields`)
  }
  for (const item of form.fields as unknown[]) {
    if (!(item instanceof Field)) {
      throw new Error(
        `The "${label}" screen's form fields must be made with field.text() and the like`
      )
    }
    const schema: FieldSchema = item.toJSON()
    if (!SCREEN_FIELD_KINDS.has(schema.kind)) {
      throw new Error(
        `The "${label}" screen's "${schema.name}" field is a ${schema.kind} field; screen forms take ${[...SCREEN_FIELD_KINDS].join(', ')}`
      )
    }
    if (schema.ability !== null) {
      throw new Error(
        `The "${label}" screen's "${schema.name}" field has an ability: on a screen, the screen's ability covers the form`
      )
    }
  }
}
