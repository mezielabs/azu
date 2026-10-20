import app from '@adonisjs/core/services/app'
import type { HttpContext } from '@adonisjs/core/http'
import type { AzuConfig } from '@mezielabs/azu/types'
import { defineScreen } from '@mezielabs/azu'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import { viewReports } from '#abilities/main'
import Order from '#models/order'

/** The ranges the report offers, in days */
export const SALES_RANGES = [7, 30, 90] as const

type Range = (typeof SALES_RANGES)[number]

function rangeOf(ctx: HttpContext): Range {
  const days = Number(ctx.request.qs().days)
  return (SALES_RANGES as readonly number[]).includes(days) ? (days as Range) : 7
}

/** `12500.50` → 1250050: totals add up in kobo, never as floats */
function toMinor(value: string | number): number {
  const [whole, fraction = ''] = String(value).split('.')
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0').slice(0, 2))
}

const toDecimal = (minor: number) =>
  `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, '0')}`

/**
 * Orders totalled by day (FR-20), for admins only (viewReports). The
 * range comes from the query string (`?days=30`); the component
 * switches it with a partial reload of `data`.
 */
export default defineScreen({
  label: 'Sales report',
  group: 'Reports',
  icon: 'chart-column',
  ability: viewReports,
  component: 'SalesReport',
  data: async (ctx) => {
    const { timezone } = app.config.get<AzuConfig>('azu')
    const days = rangeOf(ctx)
    const today = DateTime.now().setZone(timezone).startOf('day')
    const from = today.minus({ days: days - 1 })
    const format = db.connection().dialect.dateTimeFormat

    const orders = await Order.query()
      .select('placedAt', 'total')
      .where('placedAt', '>=', from.toLocal().toFormat(format))
      .whereNot('status', 'cancelled')

    // One row per day, in the admin timezone, including days with none.
    // This totals the range's orders in memory, which keeps the demo
    // readable and the same on all three databases. A large orders table
    // should aggregate in SQL instead: group by the day of placed_at in the
    // admin timezone (Postgres: AT TIME ZONE; MySQL: CONVERT_TZ) and sum
    // there, so only one row per day comes back.
    const totals = new Map<string, { orders: number; minor: number }>()
    for (let day = 0; day < days; day++) {
      totals.set(from.plus({ days: day }).toISODate()!, { orders: 0, minor: 0 })
    }
    for (const order of orders) {
      const day = totals.get(order.placedAt.setZone(timezone).toISODate()!)
      if (!day) continue
      day.orders++
      day.minor += toMinor(order.total)
    }

    const rows = [...totals].map(([day, { orders: count, minor }]) => ({
      day,
      orders: count,
      total: toDecimal(minor),
    }))
    return {
      days,
      ranges: SALES_RANGES,
      rows,
      orders: rows.reduce((sum, row) => sum + row.orders, 0),
      total: toDecimal([...totals.values()].reduce((sum, row) => sum + row.minor, 0)),
    }
  },
})
