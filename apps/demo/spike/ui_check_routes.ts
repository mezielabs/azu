/**
 * SPIKE (Phase 1 week-one UI check). Throwaway; see docs/ui-check.md.
 *
 * Server side for the UI check page at /admin/ui-check. No auth and no
 * policies: this only exercises the components.
 */
import router from '@adonisjs/core/services/router'
import app from '@adonisjs/core/services/app'
import { Inertia } from '@adonisjs/inertia'
import type { InertiaConfig } from '@adonisjs/inertia/types'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { DateTime } from 'luxon'
import Category from '#models/category'
import Product from '#models/product'

/**
 * The timezone the check treats as "the app's". Europe/London leaves
 * British Summer Time on 2026-10-25 at 01:00 UTC, so the date picker
 * gets a real DST transition to deal with.
 */
const APP_TIMEZONE = 'Europe/London'
const SORTABLE = ['name', 'sku', 'price', 'status'] as const

/**
 * Same idea as Azu's AdminInertiaMiddleware: render into azu::admin.
 */
async function adminInertia(ctx: HttpContext, next: NextFn) {
  const config = app.config.get<InertiaConfig>('inertia')
  const vite = await app.container.make('vite')
  ctx.inertia = new Inertia(ctx, { ...config, rootView: 'azu::admin' }, vite)
  return next()
}

router
  .group(() => {
    router.get('/', async ({ inertia, request, session }) => {
      const requested = request.input('sort', 'name')
      const sort = SORTABLE.includes(requested) ? requested : 'name'
      const direction = request.input('direction') === 'descending' ? 'desc' : 'asc'

      const products = await Product.query().preload('category').orderBy(sort, direction).limit(25)

      return inertia.render(
        'azu/spike/ui_check' as never,
        {
          azu: { path: '/admin' },
          timezone: APP_TIMEZONE,
          sort: { column: sort, direction: direction === 'desc' ? 'descending' : 'ascending' },
          products: products.map((product) => ({
            id: product.id,
            name: product.name,
            sku: product.sku,
            price: String(product.price),
            status: product.status,
            category: product.category.name,
          })),
          dates: {
            regular: '2026-09-02T09:15:00.000Z',
            dstEdge: '2026-10-25T00:30:00.000Z',
          },
          flash: session.flashMessages.get('success') ?? null,
        } as never
      )
    })

    /**
     * Async combobox source. `delay` simulates a slow network so
     * out-of-order responses and aborts can be checked.
     */
    router.get('/categories', async ({ request }) => {
      const search = String(request.input('search', ''))
      const delay = Math.min(Number(request.input('delay', 0)) || 0, 3000)
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay))

      const categories = await Category.query()
        .whereILike('name', `%${search}%`)
        .orderBy('name')
        .limit(20)
      return categories.map((category) => ({ id: category.id, name: category.name }))
    })

    router.post('/publish', async ({ request, response, session }) => {
      const ids = (request.input('ids', []) as unknown[]).map(Number).filter(Number.isInteger)
      await Product.query().whereIn('id', ids).update({ status: 'published' })
      session.flash('success', `${ids.length} products published`)
      return response.redirect().back()
    })

    /**
     * Echoes how the server reads the submitted value.
     */
    router.post('/date', async ({ request }) => {
      const value = String(request.input('value', ''))
      const parsed = DateTime.fromISO(value, { setZone: true })
      return {
        received: value,
        valid: parsed.isValid,
        utc: parsed.toUTC().toISO(),
        inAppZone: parsed.setZone(APP_TIMEZONE).toISO(),
        offset: parsed.setZone(APP_TIMEZONE).offsetNameShort,
      }
    })
  })
  .prefix('/admin/ui-check')
  .use(adminInertia)
