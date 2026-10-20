import type { HttpContext } from '@adonisjs/core/http'
import type { BouncerAbility } from '@adonisjs/bouncer/types'
import type { ScreenSchema } from '../schema.ts'

/**
 * A Bouncer ability, as `Bouncer.ability()` returns it. A screen needs
 * one: there's no default, so a screen never opens by accident.
 */
export type ScreenAbility = BouncerAbility<any>

/**
 * Options for `defineScreen` (FR-20).
 */
export type ScreenOptions<Data> = {
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
   * ability that throws, is denied.
   */
  ability: ScreenAbility
  /** The component from `inertia/admin/components` that renders it, by registered name */
  component: string
  /**
   * The screen's data, computed on the server for each request, after
   * the ability check. The component gets it as `data`. Return plain,
   * JSON-serialisable values. Lazy, so a partial reload of `data`
   * computes only this.
   */
  data?: (ctx: HttpContext) => Data | Promise<Data>
}

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
      component: this.options.component,
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
export function defineScreen<Data = null>(options: ScreenOptions<Data>): Screen<Data> {
  if (!options || typeof options.label !== 'string' || options.label.trim() === '') {
    throw new Error('defineScreen() needs a label')
  }
  if (typeof options.component !== 'string' || options.component === '') {
    throw new Error(`The "${options.label}" screen needs a component name`)
  }
  if (
    !options.ability ||
    typeof (options.ability as { execute?: unknown }).execute !== 'function'
  ) {
    throw new Error(
      `The "${options.label}" screen needs an ability: a Bouncer ability object, such as accessAdmin from #abilities/main`
    )
  }
  return new Screen(options)
}
