import type { HttpContext } from '@adonisjs/core/http'
import type { Azu } from '../azu.ts'
import { renderPage } from '../render.ts'
import { allows } from '../resources/abilities.ts'
import type { FormErrors } from '../schema.ts'
import { abilityAllows } from '../screens/abilities.ts'
import type { Screen } from '../screens/define_screen.ts'
import { saveScreenForm, screenFormData, screenFormFields } from '../screens/screen_form.ts'
import { RANGE_PARAM, parseRange } from '../shared/metrics.ts'
import { visibleWidgets, widgetData, widgetSchema } from '../widgets/compute.ts'
import { rangeBounds, rangeInfo } from '../widgets/ranges.ts'
import type { AzuConfig } from '../types.ts'

type Context = { config: AzuConfig; azu: Azu }

/**
 * Custom screens (FR-20) and the panel's home (FR-22). Each screen
 * checks its own ability on every request, inside the access gate.
 */
export class ScreensController {
  constructor(protected context: Context) {}

  /**
   * `<path>/screens/:screen`: the screen, a 404 when there's none by
   * that name, or the forbidden page (403) when its ability fails.
   */
  async show(ctx: HttpContext) {
    const screen = this.context.azu.screens.get(ctx.params.screen)
    if (!screen) {
      ctx.response.status(404)
      return renderPage(ctx, this.context, 'azu/errors/not_found', {})
    }
    if (!(await abilityAllows(ctx, screen.options.ability))) {
      ctx.response.status(403)
      return renderPage(ctx, this.context, 'azu/errors/forbidden', {})
    }
    return this.#render(ctx, ctx.params.screen, screen)
  }

  /**
   * PUT `<path>/screens/:screen`: saves a form screen (FR-23). The
   * screen's ability is checked again, failing closed. A valid save
   * redirects back to the screen (303); invalid input renders the form
   * again with a 422 and `errors`.
   */
  async update(ctx: HttpContext) {
    const name = ctx.params.screen
    const screen = this.context.azu.screens.get(name)
    if (!screen?.form) {
      ctx.response.status(404)
      return renderPage(ctx, this.context, 'azu/errors/not_found', {})
    }
    if (!(await abilityAllows(ctx, screen.options.ability))) {
      ctx.response.status(403)
      return renderPage(ctx, this.context, 'azu/errors/forbidden', {})
    }
    const fields = screenFormFields(screen.form)
    const result = await saveScreenForm(ctx, screen, fields, {
      timezone: this.context.config.timezone,
    })
    if (result.errors) {
      ctx.response.status(422)
      return this.#render(ctx, name, screen, result.errors)
    }
    return ctx.response
      .redirect()
      .withQs(false)
      .status(303)
      .toPath(`${this.context.config.path}/screens/${name}`)
  }

  /**
   * `<path>/`: the `home` screen with the URL unchanged, a redirect to
   * the `home` resource's list, or the welcome page. A user who fails
   * the home screen's ability, or the home resource's `viewList`, gets
   * the welcome page, not a 403.
   */
  async home(ctx: HttpContext) {
    const { home, path } = this.context.config
    if (home && typeof home === 'object') {
      // Only for a user who may list it; otherwise the welcome page, not a redirect to a 403
      const resource = this.context.azu.resources.get(home.resource)
      if (resource && (await allows(ctx, resource, 'viewList'))) {
        return ctx.response.redirect().withQs(false).toPath(`${path}/resources/${home.resource}`)
      }
      return renderPage(ctx, this.context, 'azu/dashboard', {})
    }
    const screen = home ? this.context.azu.screens.get(home) : undefined
    if (home && screen && (await abilityAllows(ctx, screen.options.ability))) {
      return this.#render(ctx, home, screen)
    }
    return renderPage(ctx, this.context, 'azu/dashboard', {})
  }

  async #render(ctx: HttpContext, name: string, screen: Screen<any>, errors: FormErrors = {}) {
    const { data } = screen.options
    return renderPage(ctx, this.context, 'azu/screen', {
      screen: screen.toSchema(name),
      // Lazy: a partial reload of `data` computes it alone
      data: async () => (data ? ((await data(ctx)) ?? null) : null),
      form: screen.form ? await screenFormData(ctx, screen, screenFormFields(screen.form)) : null,
      errors,
      ...(await this.#widgets(ctx, name, screen)),
    } as never)
  }

  /**
   * A widgets screen's props (FR-24): the widgets this user may see,
   * the range from `?range=`, and one deferred prop per widget, each in
   * its own group, so each loads in its own request after the page
   * paints and a slow or failing one never holds up the rest.
   */
  async #widgets(ctx: HttpContext, name: string, screen: Screen<any>) {
    if (!screen.widgets) return { widgets: null, range: null, ranges: [] }
    const { config } = this.context
    const timezone = config.timezone
    const rangeName = parseRange(ctx.request.qs()[RANGE_PARAM], screen.ranges)
    const bounds = rangeBounds(rangeName, timezone)
    const range = { name: rangeName, bounds, info: rangeInfo(rangeName, bounds, timezone) }
    const visible = await visibleWidgets(ctx, screen.widgets)
    const context = { path: config.path, timezone, defaultDisk: config.defaultDisk }
    return {
      widgets: visible.map(({ key, widget }) => widgetSchema(key, widget)),
      range: range.info,
      ranges: [...screen.ranges],
      ...Object.fromEntries(
        visible.map(({ key, widget }) => [
          key,
          ctx.inertia.defer(() => widgetData(ctx, context, name, widget, range), key),
        ])
      ),
    }
  }
}
