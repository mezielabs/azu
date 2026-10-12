import type { AzuPages } from './types.ts'

/**
 * Registers Azu's pages with `@adonisjs/inertia`, so
 * `ctx.inertia.render('azu/dashboard', props)` is type-checked in core
 * and in the app.
 */
declare module '@adonisjs/inertia/types' {
  interface InertiaPages extends AzuPages {}
}
