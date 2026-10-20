import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * The Overview's widgets (FR-24) narrow orders by placed_at for every
 * range, and order the Recent orders table by it. With 100,000 orders,
 * this index keeps each widget's query fast (docs/spec.md §2).
 */
export default class extends BaseSchema {
  protected tableName = 'orders'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.index(['placed_at'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['placed_at'])
    })
  }
}
