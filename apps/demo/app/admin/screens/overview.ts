import app from '@adonisjs/core/services/app'
import type { AzuConfig } from '@mezielabs/azu/types'
import { defineScreen } from '@mezielabs/azu'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import { accessAdmin } from '#abilities/main'

/**
 * A sum as an exact decimal string: Postgres and MySQL return one,
 * SQLite a number, and no rows give null
 */
function decimal(value: unknown): string {
  if (value === null || value === undefined) return '0.00'
  return typeof value === 'number' ? value.toFixed(2) : String(value)
}

/**
 * The demo's home screen (FR-20, FR-22): a few counts, each linking to
 * the list it counts.
 */
export default defineScreen({
  label: 'Overview',
  icon: 'layout-dashboard',
  ability: accessAdmin,
  component: 'Overview',
  data: async () => {
    const { path, timezone } = app.config.get<AzuConfig>('azu')
    const format = db.connection().dialect.dateTimeFormat
    const now = DateTime.now().setZone(timezone)
    const today = now.startOf('day')
    const month = now.startOf('month')
    // Stored in the server's time: compare in it
    const since = (start: DateTime) => start.toLocal().toFormat(format)

    const [ordersToday] = await db
      .from('orders')
      .where('placed_at', '>=', since(today))
      .count('* as total')
    const [revenue] = await db
      .from('orders')
      .where('placed_at', '>=', since(month))
      .whereNot('status', 'cancelled')
      .sum('total as total')
    const [lowStock] = await db.from('products').where('stock', '<', 10).count('* as total')

    // The orders list's date filter takes whole days in the admin timezone
    const range = (from: DateTime) => `${from.toISODate()}..${now.toISODate()}`
    return {
      ordersToday: {
        count: Number(ordersToday.total),
        href: `${path}/resources/orders?placedAt=${range(today)}`,
      },
      revenueThisMonth: {
        // Exact: decimals stay strings
        total: decimal(revenue.total),
        month: now.toFormat('LLLL'),
        href: `${path}/resources/orders?placedAt=${range(month)}`,
      },
      lowStock: {
        count: Number(lowStock.total),
        href: `${path}/resources/products?low-stock=1`,
      },
    }
  },
})
