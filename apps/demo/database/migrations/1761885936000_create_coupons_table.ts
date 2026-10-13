import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Discount codes. Every form field kind in FR-06 maps to a column here:
 * text, textarea, select (as radios and as a dropdown), decimal,
 * number, boolean, date and datetime.
 */
export default class extends BaseSchema {
  protected tableName = 'coupons'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('code', 32).notNullable().unique()
      table.text('description').nullable()
      table.enum('kind', ['percent', 'fixed', 'free_shipping']).notNullable()
      table.decimal('amount', 12, 2).notNullable()
      table.string('currency', 3).notNullable()
      table.integer('usage_limit').nullable()
      table.boolean('is_active').notNullable().defaultTo(true)
      table.date('starts_on').notNullable()
      table.timestamp('expires_at').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
