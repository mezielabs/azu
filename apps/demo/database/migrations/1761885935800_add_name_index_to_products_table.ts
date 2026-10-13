import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Products sort by name in the admin list, and spec §2's list
 * performance target assumes indexed sort columns.
 */
export default class extends BaseSchema {
  protected tableName = 'products'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.index(['name'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['name'])
    })
  }
}
