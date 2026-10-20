import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'

/**
 * Bulk-inserts orders for the widgets benchmark (FR-24, spec §2):
 *
 *   DB_CONNECTION=pg node ace bench:orders --count=100000
 *
 * Spread over the past year and across statuses, for the seeded
 * customers, so every range and the comparison period have orders.
 */
export default class BenchOrders extends BaseCommand {
  static commandName = 'bench:orders'
  static description = 'Insert orders in bulk for the widgets benchmark'
  static options: CommandOptions = { startApp: true }

  @flags.number({ description: 'How many orders to insert', default: 100_000 })
  declare count: number

  async run() {
    const customers = await db.from('users').where('role', 'customer').select('id')
    if (customers.length === 0) {
      this.logger.error('Seed the database first: node ace migration:fresh --seed')
      this.exitCode = 1
      return
    }

    const statuses = ['pending', 'paid', 'shipped', 'cancelled']
    const now = Date.now()
    const year = 365 * 86_400_000
    const chunk = 1000
    const started = Date.now()
    for (let offset = 0; offset < this.count; offset += chunk) {
      const rows = Array.from({ length: Math.min(chunk, this.count - offset) }, (_, i) => {
        const n = offset + i + 1
        const placedAt = new Date(now - ((n * 7919) % this.count) * (year / this.count))
        return {
          user_id: customers[n % customers.length].id,
          number: `BENCH-${n}`,
          status: statuses[n % statuses.length],
          total: `${(n % 90_000) + 500}.${String(n % 100).padStart(2, '0')}`,
          placed_at: placedAt,
          created_at: placedAt,
          updated_at: placedAt,
        }
      })
      await db.table('orders').multiInsert(rows)
    }

    this.logger.success(
      `Inserted ${this.count} orders in ${((Date.now() - started) / 1000).toFixed(1)}s`
    )
  }
}
