import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * A coupon can be limited to one category: an optional belongsTo, so
 * the demo shows the relation select's Clear button.
 */
export default class extends BaseSchema {
  protected tableName = 'coupons'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .integer('category_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('categories')
        .onDelete('SET NULL')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['category_id'])
      table.dropColumn('category_id')
    })
  }
}
