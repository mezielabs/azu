import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'

/**
 * Bulk-inserts products for the list screen benchmark (spec §2, §10):
 *
 *   DB_CONNECTION=pg node ace bench:products --count=100000
 *
 * Fast multi-row inserts, so 100,000 rows take seconds, not minutes.
 */
export default class BenchProducts extends BaseCommand {
  static commandName = 'bench:products'
  static description = 'Insert products in bulk for the list benchmark'
  static options: CommandOptions = { startApp: true }

  @flags.number({ description: 'How many products to insert', default: 100_000 })
  declare count: number

  async run() {
    const categories = await db.from('categories').select('id')
    if (categories.length === 0) {
      this.logger.error('Seed the database first: node ace migration:fresh --seed')
      this.exitCode = 1
      return
    }

    const now = new Date()
    const chunk = 1000
    const started = Date.now()
    for (let offset = 0; offset < this.count; offset += chunk) {
      const rows = Array.from({ length: Math.min(chunk, this.count - offset) }, (_, i) => {
        const n = offset + i + 1
        return {
          category_id: categories[n % categories.length].id,
          name: `Bench product ${String(n).padStart(6, '0')}`,
          sku: `BENCH-${n}`,
          description: null,
          price: `${(n % 50_000) + 1}.${String(n % 100).padStart(2, '0')}`,
          stock: n % 200,
          status: n % 4 === 0 ? 'draft' : 'published',
          is_featured: n % 10 === 0,
          thumbnail: null,
          published_at: null,
          // Spread over the past year, so a date range filter is selective
          created_at: new Date(now.getTime() - (n % 365) * 86_400_000),
          updated_at: now,
        }
      })
      await db.table('products').multiInsert(rows)
    }

    this.logger.success(
      `Inserted ${this.count} products in ${((Date.now() - started) / 1000).toFixed(1)}s`
    )
  }
}
